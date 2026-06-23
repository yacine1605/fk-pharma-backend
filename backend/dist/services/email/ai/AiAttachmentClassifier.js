import OpenAI from "openai";
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
function normalizeOcrText(text) {
    return text
        .toLowerCase()
        .replace(/0/g, "o")
        .replace(/1/g, "i")
        .replace(/5/g, "s")
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function normalizeConfidence(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) {
        return 0;
    }
    if (num > 1) {
        return Math.min(num / 100, 1);
    }
    return Math.max(0, Math.min(num, 1));
}
function heuristicAttachmentType(params) {
    const fileName = params.fileName.toLowerCase();
    const mime = (params.mimeType || "").toLowerCase();
    const text = normalizeOcrText(`${fileName}\n${params.extractedText || ""}`);
    // PROFORMA first, even if scanned image/PDF
    let proformaScore = 0;
    if (text.includes("proforma"))
        proformaScore += 5;
    if (text.includes("facture proforma"))
        proformaScore += 5;
    if (text.includes("quotation"))
        proformaScore += 4;
    if (text.includes("devis"))
        proformaScore += 4;
    if (text.includes("total ht"))
        proformaScore += 4;
    if (text.includes("montant ht"))
        proformaScore += 4;
    if (text.includes("net a payer"))
        proformaScore += 4;
    if (text.includes("pu ht"))
        proformaScore += 4;
    if (text.includes("prix unitaire"))
        proformaScore += 3;
    if (text.includes("total ttc"))
        proformaScore += 4;
    if (text.includes("tva"))
        proformaScore += 3;
    if (text.includes("quantite"))
        proformaScore += 2;
    if (text.includes("designation"))
        proformaScore += 2;
    if (text.includes("montant"))
        proformaScore += 2;
    if (proformaScore >= 6) {
        return "proforma";
    }
    // TECHNICAL SHEET second
    let technicalScore = 0;
    if (text.includes("technical specifications"))
        technicalScore += 5;
    if (text.includes("technical data"))
        technicalScore += 4;
    if (text.includes("datasheet"))
        technicalScore += 5;
    if (text.includes("specification"))
        technicalScore += 3;
    if (text.includes("fiche technique"))
        technicalScore += 5;
    if (text.includes("caracteristiques techniques"))
        technicalScore += 5;
    if (text.includes("caractéristiques techniques"))
        technicalScore += 5;
    if (text.includes("parametres mesures"))
        technicalScore += 4;
    if (text.includes("paramètres mesurés"))
        technicalScore += 4;
    if (text.includes("accessoires inclus"))
        technicalScore += 3;
    if (text.includes("plage de mesure"))
        technicalScore += 3;
    if (text.includes("precision"))
        technicalScore += 2;
    if (text.includes("précision"))
        technicalScore += 2;
    if (technicalScore >= 5) {
        return "technical_sheet";
    }
    // CATALOG
    let catalogScore = 0;
    if (text.includes("catalogue"))
        catalogScore += 5;
    if (text.includes("catalog"))
        catalogScore += 4;
    if (text.includes("brochure"))
        catalogScore += 4;
    if (text.includes("product range"))
        catalogScore += 4;
    if (catalogScore >= 5) {
        return "catalog";
    }
    // SPREADSHEET
    if (mime.includes("spreadsheet") ||
        mime.includes("excel") ||
        /\.(xlsx|xls|csv)$/i.test(fileName)) {
        return "spreadsheet";
    }
    // IMAGE only if no business/technical meaning found
    if (mime.startsWith("image/") ||
        /\.(png|jpg|jpeg|webp|bmp|tiff)$/i.test(fileName)) {
        return "image";
    }
    if (/\.(pdf|doc|docx)$/i.test(fileName)) {
        return "document";
    }
    return null;
}
export function buildAttachmentClassificationPrompt(params) {
    return `
You classify medical supplier attachments.

Return ONLY valid JSON.
No markdown.
No explanations.

Possible types:
- proforma
- technical_sheet
- catalog
- spreadsheet
- document
- image
- other

IMPORTANT:

A document is "proforma" if it contains:
- pricing
- PU HT
- TOTAL HT
- TVA
- NET A PAYER
- quantities
- quotation tables
- commercial offer lines

Even scanned PDFs count as proforma.

Filename:
${params.fileName}

MimeType:
${params.mimeType || ""}

Extracted Text:
${(params.extractedText || "").slice(0, 12000)}

Return format:
{
  "type": "proforma",
  "confidence": 0.95,
  "reason": "contains commercial pricing table"
}
`;
}
export function safeParseAttachmentClassification(content) {
    try {
        const cleaned = content.trim();
        const match = cleaned.match(/\{[\s\S]*?\}/);
        if (!match) {
            return null;
        }
        const parsed = JSON.parse(match[0]);
        return {
            type: parsed.type,
            confidence: normalizeConfidence(parsed.confidence),
            reason: parsed.reason,
        };
    }
    catch (error) {
        console.error("[CLASSIFICATION JSON PARSE ERROR]", error);
        return null;
    }
}
export async function classifyAttachmentWithAI(params) {
    // 1. Heuristic classification first
    const heuristicType = heuristicAttachmentType(params);
    if (heuristicType) {
        return {
            type: heuristicType,
            confidence: 0.98,
            reason: "heuristic classification",
        };
    }
    // 2. AI fallback
    try {
        const prompt = buildAttachmentClassificationPrompt({
            fileName: params.fileName,
            mimeType: params.mimeType ?? undefined,
            extractedText: params.extractedText,
        });
        const completion = await openai.responses.create({
            model: "gpt-5.4-mini", // ← CORRIGÉ: modèle cohérent et économique
            instructions: "Return ONLY raw JSON. No markdown. No explanations.",
            input: prompt,
            store: false,
        });
        const aiContent = completion.output_text ?? "";
        const parsed = safeParseAttachmentClassification(aiContent);
        if (!parsed) {
            return {
                type: heuristicType ?? "document",
                confidence: 0.2,
                reason: "AI parsing failed",
            };
        }
        return {
            type: parsed.type || heuristicType || "document",
            confidence: normalizeConfidence(parsed.confidence),
            reason: parsed.reason,
        };
    }
    catch (error) {
        console.error("[AI ATTACHMENT CLASSIFICATION ERROR]", error);
        return {
            type: heuristicType ?? "document",
            confidence: 0,
            reason: "AI classification error",
        };
    }
}
//# sourceMappingURL=AiAttachmentClassifier.js.map