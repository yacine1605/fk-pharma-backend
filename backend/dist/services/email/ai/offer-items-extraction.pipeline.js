// offer-items-extraction.pipeline.ts
import OpenAI from "openai";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "../../../db/drizzle";
import { offerItems, offers } from "../../../db/schema";
import { extractTextFromDocx, extractTextFromExcel, extractTextSmart, } from "./exctraction";
import { buildOfferItemsPrompt, dedupeOfferItems, safeParseOfferItems, } from "./AiOfferItemsExtraction";
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
export async function processOfferItemsFromAttachments(offerId, options = {}) {
    const overwrite = options.overwrite ?? false;
    // =========================
    // LOAD OFFER + ATTACHMENTS
    // =========================
    const offer = await db.query.offers.findFirst({
        where: eq(offers.id, offerId),
        with: {
            offerAttachments: true,
        },
    });
    if (!offer) {
        return {
            success: false,
            message: "Offer not found",
        };
    }
    // =========================
    // CHECK EXISTING ITEMS
    // =========================
    const existingItems = await db
        .select()
        .from(offerItems)
        .where(eq(offerItems.offerId, offerId));
    if (existingItems.length > 0 && !overwrite) {
        return {
            success: true,
            skipped: true,
            message: "Offer items already exist",
            itemsCount: existingItems.length,
        };
    }
    // =========================
    // FLATTEN ATTACHMENTS
    // =========================
    const attachments = offer.offerAttachments ?? [];
    [];
    if (attachments.length === 0) {
        return {
            success: false,
            message: "No attachments found",
        };
    }
    // =========================
    // EXTRACT TEXT
    // =========================
    let fullText = "";
    for (const attachment of attachments) {
        try {
            const text = await extractTextFromOfferAttachment({
                filePath: attachment.filePath,
                originalFileName: attachment.fileName,
            });
            if (text?.trim()) {
                fullText += `\n\n===== FILE: ${attachment.fileName} =====\n`;
                fullText += text;
            }
        }
        catch (error) {
            console.error(`Failed extracting text from ${attachment.fileName}`, error);
        }
    }
    if (!fullText.trim()) {
        return {
            success: false,
            message: "Could not extract text from attachments",
        };
    }
    // =========================
    // AI EXTRACTION
    // =========================
    const cleanedText = preCleanOcrText(fullText);
    const extraction = await extractOfferItemsWithAi(cleanedText);
    if (!extraction || !Array.isArray(extraction.items)) {
        return {
            success: false,
            message: "AI failed to extract offer items",
        };
    }
    // =========================
    // VALIDATE ITEMS
    // =========================
    const validItems = dedupeOfferItems(extraction.items.filter((item) => item?.name?.trim()));
    if (validItems.length === 0) {
        return {
            success: false,
            message: "No valid offer items extracted",
        };
    }
    // =========================
    // SAVE ITEMS
    // =========================
    await db.transaction(async (tx) => {
        if (overwrite) {
            await tx.delete(offerItems).where(eq(offerItems.offerId, offerId));
        }
        for (let index = 0; index < validItems.length; index++) {
            const item = validItems[index];
            await tx.insert(offerItems).values({
                offerId,
                itemNumber: item.itemNumber ?? index + 1,
                code: item.code ?? null,
                name: item.name.trim(),
                description: item.description ?? null,
                requestedQuantity: Number(item.requestedQuantity) || 1,
                technicalRequirements: Array.isArray(item.technicalRequirements)
                    ? item.technicalRequirements
                    : [],
                minConformityPercentage: typeof item.minConformityPercentage === "number"
                    ? item.minConformityPercentage
                    : 70,
            });
        }
    });
    return {
        success: true,
        offerId,
        itemsCount: validItems.length,
        confidence: extraction.confidence ?? 0,
        items: validItems,
    };
}
// ======================================================
// ATTACHMENT TEXT EXTRACTION
// ======================================================
async function extractTextFromOfferAttachment(params) {
    const ext = path.extname(params.originalFileName).toLowerCase();
    if (ext === ".pdf") {
        const result = await extractTextSmart(params.filePath);
        return result.text ?? "";
    }
    if (ext === ".docx" || ext === ".doc") {
        return await extractTextFromDocx(params.filePath);
    }
    if (ext === ".xlsx" || ext === ".xls") {
        return await extractTextFromExcel(params.filePath);
    }
    return "";
}
// ======================================================
// AI EXTRACTION
// ======================================================
async function extractOfferItemsWithAi(text) {
    const prompt = buildOfferItemsPrompt(text);
    const completion = await openai.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-5",
        instructions: "You extract structured biomedical tender or offer requested items.",
        input: prompt,
        store: true,
    });
    const aiContent = completion.output_text ?? "";
    return safeParseOfferItems(aiContent);
}
export function preCleanOcrText(text) {
    return (text
        // Fix known OCR patterns in French medical docs
        .replace(/\bMU\b/gi, "multi") // "MU paramètres" → "multi paramètres"
        .replace(/\bpar[æéè]n[eè]se\b/gi, "paramètres")
        .replace(/\bpar[æéè]metres\b/gi, "paramètres")
        .replace(/\bparam[eè]tres\b/gi, "paramètres")
        .replace(/\bpar[æéè]m[eè]tres\b/gi, "paramètres")
        // Fix number confusions
        .replace(/([a-zA-Z])0([a-zA-Z])/g, "$1O$2") // 0 between letters → O
        .replace(/\b0([A-Z])/g, "O$1") // 0 before capital → O
        // Fix common scan artifacts
        .replace(/[—–−]/g, "-") // em-dash, en-dash → hyphen
        .replace(/[""]/g, '"') // smart quotes → straight
        .replace(/['']/g, "'") // smart apostrophes → straight
        // Fix "Quantité" corruptions
        .replace(/\bQuanti[Ééè]\s+\w+/gi, (match) => {
        // Try to reconstruct "Quantité Quatre (04)" etc.
        return match
            .replace(/É/g, "é")
            .replace(/uwatre/gi, "Quatre")
            .replace(/uatre/gi, "Quatre")
            .replace(/rois/gi, "Trois")
            .replace(/eux/gi, "Deux")
            .replace(/n/gi, "Un");
    })
        // Clean up garbage sequences
        .replace(/\s*[,;]\s*oo\s*$/gm, "") // trailing garbage like "}, oo"
        .replace(/\s*}\s*,\s*oo\s*/g, "") // "}, oo" patterns
        // Preserve structure markers
        .replace(/(\d{2})\/-\s*/g, "$1/- ") // normalize "02/-" spacing
        .replace(/(\d{2})\.\s*/g, "$1. ") // normalize "01." spacing
        // Fix "j0S" → "iOS" (common OCR error)
        .replace(/\bj0S\b/gi, "iOS")
        .replace(/\bjOS\b/gi, "iOS")
    // Fix "Nérdon® ai 5 a" → keep as is but flag (too corrupted)
    );
}
//# sourceMappingURL=offer-items-extraction.pipeline.js.map