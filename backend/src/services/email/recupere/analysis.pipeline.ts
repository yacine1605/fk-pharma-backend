import OpenAI from "openai";
import path from "path";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "../../../db/drizzle";

import {
  notifications,
  offerItems,
  supplierGlobalAnalyses,
  supplierItemAnalyses,
  supplierProformaLines,
  supplierProformas,
  supplierResponseAttachments,
  supplierResponses,
  suppliers,
} from "../../../db/schema";
import { ocrImage } from "./image-ocr";
import { buildProformaPrompt, safeParseProforma } from "./AiProformaExtraction";

import {
  buildConformityPrompt,
  detectProductFamily,
  safeParseConformity,
  similarityScore,
  genericEquivalenceScore,
  areGenericEquivalent,
} from "./AiConformityResult";

import { classifyAttachmentWithAI } from "./AiAttachmentClassifier";
import { supplierAnalysisQueue } from "./queues";

import { calculateConditionsScore } from "./conditions-score.service";

import {
  extractTextFromDocx,
  extractTextSmart,
  extractTextFromExcel,
} from "./exctraction";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ← CORRIGÉ: Centralisation du modèle pour tâches complexes
const COMPLEX_MODEL = "gpt-5.4";

type PipelineResult = {
  supplierResponseId: string;
  status: "analyzed" | "needs_review" | "failed";
  message: string;
};

function normalizeConformityResult<
  T extends {
    conformityPercentage: number;
    mandatoryMissingCount: number;
    isTechnicallyCompliant: boolean;
    quantityRequested: number | null;
    quantityOffered: number | null;
    details: {
      required: boolean;
      weight: number;
      score: number;
    }[];
  },
>(result: T, requestedQuantity?: number): T {
  const totalWeight = result.details.reduce((sum, detail) => {
    return sum + Number(detail.weight ?? 0);
  }, 0);

  const totalScore = result.details.reduce((sum, detail) => {
    const weight = Number(detail.weight ?? 0);
    const score = clamp(Number(detail.score ?? 0), 0, weight);
    detail.score = score;
    return sum + score;
  }, 0);

  const percentage =
    totalWeight > 0 ? round2((totalScore / totalWeight) * 100) : 0;

  const mandatoryMissingCount = result.details.filter((detail) => {
    return detail.required && Number(detail.score ?? 0) <= 0;
  }).length;

  const quantityRequested = Number(
    requestedQuantity ?? result.quantityRequested ?? 0,
  );
  const quantityOffered = Number(result.quantityOffered ?? 0);

  const quantityOk =
    quantityRequested <= 0 ||
    result.quantityOffered === null ||
    quantityOffered >= quantityRequested;

  result.conformityPercentage = clamp(percentage, 0, 100);
  result.mandatoryMissingCount = mandatoryMissingCount;
  result.quantityRequested = quantityRequested;

  result.isTechnicallyCompliant =
    result.conformityPercentage >= 70 &&
    mandatoryMissingCount === 0 &&
    quantityOk;

  return result;
}

type AttachmentExtractedResult = {
  attachmentId: string;
  attachmentType: string;
  text: string;
};

export async function processSupplierResponsePipeline(
  supplierResponseId: string,
  options: { force?: boolean },
): Promise<PipelineResult> {
  const allowedStatuses = options.force
    ? ["received", "needs_review", "analyzed"]
    : ["received", "needs_review"];

  const [claimed] = await db
    .update(supplierResponses)
    .set({
      status: "analyzing",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(supplierResponses.id, supplierResponseId),
        inArray(supplierResponses.status, allowedStatuses),
        eq(supplierResponses.isNegativeResponse, false),
      ),
    )
    .returning();

  if (!claimed) {
    const existing = await db.query.supplierResponses.findFirst({
      where: eq(supplierResponses.id, supplierResponseId),
    });

    if (!existing) {
      return {
        supplierResponseId,
        status: "failed",
        message: "Supplier response not found",
      };
    }

    return {
      supplierResponseId,
      status: "needs_review",
      message: `Response already being processed or not processable. Current status: ${existing.status}`,
    };
  }

  const response = await db.query.supplierResponses.findFirst({
    where: eq(supplierResponses.id, supplierResponseId),
    with: {
      supplier: true,
      offer: {
        with: {
          offerItems: true,
        },
      },
      attachments: true,
    },
  });

  if (!response) {
    return {
      supplierResponseId,
      status: "failed",
      message: "Supplier response not found after claim",
    };
  }

  try {
    await db
      .delete(supplierItemAnalyses)
      .where(eq(supplierItemAnalyses.supplierResponseId, supplierResponseId));

    await db
      .delete(supplierProformas)
      .where(eq(supplierProformas.supplierResponseId, supplierResponseId));

    const extractedAttachments = await extractAttachmentsText(response);

    let proformaText = extractedAttachments
      .filter((item) => item.attachmentType === "proforma")
      .map((item) => item.text)
      .join("\n\n");

    if (!proformaText.trim()) {
      proformaText = extractedAttachments
        .filter((item) => {
          const text = item.text.toLowerCase();
          return (
            text.includes("proforma") ||
            text.includes("devis") ||
            text.includes("total ht") ||
            text.includes("total ttc") ||
            text.includes("pu ht") ||
            text.includes("prix unitaire") ||
            text.includes("net a payer") ||
            text.includes("tva")
          );
        })
        .map((item) => item.text)
        .join("\n\n");
    }

    const technicalText = extractedAttachments
      .filter((item) =>
        ["technical_sheet", "catalog", "document", "other", "image"].includes(
          item.attachmentType,
        ),
      )
      .map((item) => {
        return [
          `--- ATTACHMENT ${item.attachmentId} / ${item.attachmentType} ---`,
          item.text,
        ].join("\n");
      })
      .join("\n\n");

    if (!proformaText.trim()) {
      await markResponseAsNeedsReview(supplierResponseId, "No proforma found");

      await createNotification({
        type: "missing_documents",
        offerId: response.offerId,
        supplierId: response.supplierId,
        supplierResponseId,
        title: "Missing proforma",
        message: `Supplier ${response.supplier.name} did not provide a valid proforma.`,
      });

      console.log("[PIPELINE] extracted attachments", {
        supplierResponseId,
        count: extractedAttachments.length,
        types: extractedAttachments.map((a) => ({
          id: a.attachmentId,
          type: a.attachmentType,
          textLength: a.text.length,
        })),
      });

      return {
        supplierResponseId,
        status: "needs_review",
        message: "No proforma found",
      };
    }

    const proformaExtraction = await extractProformaWithAi(proformaText);

    if (!proformaExtraction) {
      await markResponseAsNeedsReview(
        supplierResponseId,
        "AI extraction failed",
      );

      return {
        supplierResponseId,
        status: "needs_review",
        message: "AI extraction failed",
      };
    }

    const [createdProforma] = await db
      .insert(supplierProformas)
      .values({
        supplierResponseId,
        proformaNumber: proformaExtraction.proformaNumber,
        proformaDate: parseDateOrNull(proformaExtraction.proformaDate),
        customerName: proformaExtraction.customerName,
        totalHT: toDecimalString(proformaExtraction.totalHT),
        totalTVA: toDecimalString(proformaExtraction.totalTVA),
        stampDuty: toDecimalString(proformaExtraction.stampDuty),
        totalTTC: toDecimalString(proformaExtraction.totalTTC),
        currency: proformaExtraction.currency ?? "DZD",
        paymentTerms: proformaExtraction.paymentTerms,
        validityText: proformaExtraction.validityText,
        validityDays: toIntegerOrNull(proformaExtraction.validityDays),
        extractedJson: proformaExtraction as unknown as Record<string, unknown>,
        confidence: proformaExtraction.confidence ?? 0,
      })
      .returning();

    const requestedItems = response.offer.offerItems;

    if (requestedItems.length === 0) {
      await markResponseAsNeedsReview(
        supplierResponseId,
        "No offer items found. Extract offer items before supplier analysis.",
      );

      await createNotification({
        type: "manual_review_required",
        offerId: response.offerId,
        supplierId: response.supplierId,
        supplierResponseId,
        title: "Articles de l'offre manquants",
        message:
          "Aucun article n'a été extrait depuis le cahier des charges. Lancez l'extraction des articles avant l'analyse fournisseur.",
      });

      return {
        supplierResponseId,
        status: "needs_review",
        message: "No offer items found",
      };
    }

    for (const line of proformaExtraction.lines ?? []) {
      if (!line.designation?.trim()) {
        continue;
      }

      const matchedOfferItem = matchProformaLineToOfferItem(
        {
          lineNumber: line.lineNumber,
          designation: line.designation,
          code: line.code,
        },
        requestedItems,
      );

      const [createdLine] = await db
        .insert(supplierProformaLines)
        .values({
          proformaId: createdProforma.id,
          offerItemId: matchedOfferItem?.id ?? null,
          lineNumber: toIntegerOrNull(line.lineNumber),
          supplierProductCode: line.code,
          designation: line.designation,
          brand: line.brand,
          quantity: toIntegerOrNull(line.quantity),
          unitPriceHT: toDecimalString(line.unitPriceHT),
          discountPercentage: line.discountPercentage ?? 0,
          totalHT: toDecimalString(line.totalHT),
          tvaPercentage: line.tvaPercentage ?? 0,
          rawText: JSON.stringify(line),
        })
        .returning();

      if (!matchedOfferItem) {
        await createNotification({
          type: "manual_review_required",
          offerId: response.offerId,
          supplierId: response.supplierId,
          supplierResponseId,
          title: "Ligne proforma non associée",
          message: `La ligne "${line.designation}" n'a pas pu être associée à un article du cahier des charges.`,
        });

        continue;
      }

      const relevantTechnicalText = filterTechnicalTextForLine({
        lineDesignation: line.designation,
        lineCode: line.code,
        matchedItemName: matchedOfferItem.name,
        allTechnicalText: technicalText,
      });

      const conformityResult = await analyzeConformityWithAi({
        requestedItem: {
          id: matchedOfferItem.id,
          name: matchedOfferItem.name,
          requestedQuantity: matchedOfferItem.requestedQuantity,
          technicalRequirements: matchedOfferItem.technicalRequirements,
        },
        proformaText: JSON.stringify(line, null, 2),
        technicalText: relevantTechnicalText,
      });

      if (!conformityResult) {
        continue;
      }

      const normalizedConformityResult = normalizeConformityResult(
        conformityResult,
        matchedOfferItem.requestedQuantity,
      );

      if (
        normalizedConformityResult.quantityOffered !== null &&
        normalizedConformityResult.quantityRequested !== null &&
        normalizedConformityResult.quantityOffered <
          normalizedConformityResult.quantityRequested
      ) {
        await createNotification({
          type: "manual_review_required",
          offerId: response.offerId,
          supplierId: response.supplierId,
          supplierResponseId,
          title: "Quantité insuffisante",
          message: `Le fournisseur propose ${normalizedConformityResult.quantityOffered} pour "${matchedOfferItem.name}", alors que la quantité demandée est ${normalizedConformityResult.quantityRequested}.`,
        });
      }

      const conformityPercentage =
        normalizedConformityResult.conformityPercentage;

      await db.insert(supplierItemAnalyses).values({
        supplierResponseId,
        offerItemId: matchedOfferItem.id,
        proformaLineId: createdLine.id,
        status: conformityPercentage >= 70 ? "completed" : "needs_review",
        proposedProductName:
          conformityResult.proposedProductName ?? line.designation,
        proposedProductCode: conformityResult.proposedProductCode ?? line.code,
        proposedBrand: conformityResult.proposedBrand ?? line.brand,
        quantityRequested: matchedOfferItem.requestedQuantity,
        quantityOffered: toIntegerOrNull(line.quantity),
        unitPriceHT: toDecimalString(line.unitPriceHT),
        totalHT: toDecimalString(line.totalHT),
        tvaPercentage: line.tvaPercentage ?? 0,
        conformityPercentage,
        mandatoryMissingCount:
          normalizedConformityResult.mandatoryMissingCount ?? 0,
        isTechnicallyCompliant:
          normalizedConformityResult.isTechnicallyCompliant ?? false,
        analysisDetails: normalizedConformityResult.details ?? [],
        aiSummary: normalizedConformityResult.summary,
        aiRecommendation: normalizedConformityResult.recommendation,
      });
    }

    const analysesAfterProcessing = await db
      .select()
      .from(supplierItemAnalyses)
      .where(eq(supplierItemAnalyses.supplierResponseId, supplierResponseId));

    const hasNeedsReview = analysesAfterProcessing.some((analysis) => {
      return analysis.status === "needs_review";
    });

    await db
      .update(supplierResponses)
      .set({
        status: hasNeedsReview ? "needs_review" : "analyzed",
        analyzedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(supplierResponses.id, supplierResponseId));

    return {
      supplierResponseId,
      status: "analyzed",
      message: "Analysis completed",
    };
  } catch (error) {
    console.error(error);

    await db
      .update(supplierResponses)
      .set({
        status: "needs_review",
        updatedAt: new Date(),
      })
      .where(eq(supplierResponses.id, supplierResponseId));

    return {
      supplierResponseId,
      status: "failed",
      message: "Pipeline failed",
    };
  }
}

export async function runPendingSupplierResponsesPipeline() {
  return enqueuePendingSupplierResponsesPipeline();
}

export async function enqueuePendingSupplierResponsesPipeline() {
  const pendingResponses = await db
    .select()
    .from(supplierResponses)
    .where(
      and(
        inArray(supplierResponses.status, ["received"]),
        eq(supplierResponses.isNegativeResponse, false),
      ),
    );

  for (const response of pendingResponses) {
    await supplierAnalysisQueue.add(
      "analyze-supplier-response",
      {
        supplierResponseId: response.id,
      },
      {
        jobId: `analyze-${response.id}`,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 30_000,
        },
        removeOnComplete: 500,
        removeOnFail: 500,
      },
    );
  }

  return {
    queued: pendingResponses.length,
  };
}

export async function processOfferAnalysisPipeline(offerId: string) {
  const responses = await db
    .select()
    .from(supplierResponses)
    .where(
      and(
        eq(supplierResponses.offerId, offerId),
        inArray(supplierResponses.status, ["received", "needs_review"]),
        eq(supplierResponses.isNegativeResponse, false),
      ),
    );

  const results: PipelineResult[] = [];

  for (const response of responses) {
    const result = await processSupplierResponsePipeline(response.id, {
      force: true,
    });
    results.push(result);
  }

  return results;
}

async function extractAttachmentsText(response: {
  attachments: {
    id: string;
    attachmentType: string;
    filePath: string;
    originalFileName: string;
    mimeType: string | null;
    extractedText: string | null;
  }[];
}): Promise<AttachmentExtractedResult[]> {
  const results: AttachmentExtractedResult[] = [];

  for (const attachment of response.attachments) {
    const ext = path.extname(attachment.originalFileName).toLowerCase();

    let text = "";
    let method: "pdf_text" | "ocr" | "docx" | "excel" | "image_ocr" | undefined;
    let pages: number | undefined;
    let ocrRequired = false;
    let ocrDone = false;
    let hasTextLayer = false;

    try {
      if (attachment.extractedText?.trim()) {
        text = attachment.extractedText;
      } else if (ext === ".pdf") {
        const result = await extractTextSmart(attachment.filePath);
        text = result.text;
        method = result.method;
        pages = result.pages;
        ocrRequired = result.ocrRequired;
        ocrDone = result.method === "ocr";
        hasTextLayer = result.method === "pdf_text";
      } else if (ext === ".docx" || ext === ".doc") {
        text = await extractTextFromDocx(attachment.filePath);
        method = "docx";
        hasTextLayer = true;
      } else if (ext === ".xlsx" || ext === ".xls") {
        text = await extractTextFromExcel(attachment.filePath);
        method = "excel";
        hasTextLayer = true;
      } else if (
        [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"].includes(ext)
      ) {
        text = await ocrImage(attachment.filePath);
        method = "image_ocr";
        ocrRequired = true;
        ocrDone = true;
      }

      const classification = await classifyAttachmentWithAI({
        fileName: attachment.originalFileName,
        mimeType: attachment.mimeType,
        extractedText: text,
      });

      const attachmentType = classification?.type ?? "other";

      await db
        .update(supplierResponseAttachments)
        .set({
          attachmentType,
          extractedText: text,
          pageCount: pages,
          hasTextLayer,
          ocrRequired,
          ocrDone,
          extractionMetadata: {
            method,
            pages,
            aiClassification: classification,
          },
        })
        .where(eq(supplierResponseAttachments.id, attachment.id));

      results.push({
        attachmentId: attachment.id,
        attachmentType,
        text,
      });
    } catch (error) {
      console.error("[ATTACHMENT EXTRACTION ERROR]", {
        attachmentId: attachment.id,
        error,
      });

      results.push({
        attachmentId: attachment.id,
        attachmentType: "other",
        text: "",
      });
    }
  }

  return results;
}

async function extractProformaWithAi(text: string) {
  const prompt = buildProformaPrompt(text);

  const completion = await openai.responses.create({
    model: COMPLEX_MODEL, // ← CORRIGÉ: Utilise la constante centralisée
    instructions: "You extract structured medical proforma invoice data.",
    input: prompt,
    store: true,
  });

  const aiContent = completion.output_text ?? "";

  return safeParseProforma(aiContent);
}

function filterTechnicalTextForLine(params: {
  lineDesignation: string;
  lineCode: string | null;
  matchedItemName: string;
  allTechnicalText: string;
}) {
  const family = detectProductFamily(
    [
      params.lineDesignation,
      params.lineCode ?? "",
      params.matchedItemName,
    ].join(" "),
  );

  const blocks = params.allTechnicalText
    .split(/--- ATTACHMENT/g)
    .map((block) => block.trim())
    .filter(Boolean);

  const filtered = blocks.filter((block) => {
    const blockFamily = detectProductFamily(block);

    if (family === "unknown") {
      return true;
    }

    return blockFamily === family;
  });

  if (filtered.length === 0) {
    return params.allTechnicalText;
  }

  return filtered.map((block) => `--- ATTACHMENT ${block}`).join("\n\n");
}

async function analyzeConformityWithAi(params: {
  requestedItem: {
    id: string;
    name: string;
    requestedQuantity: number;
    technicalRequirements: unknown;
  };
  proformaText: string;
  technicalText: string;
}) {
  const prompt = buildConformityPrompt(params);

  const completion = await openai.responses.create({
    model: COMPLEX_MODEL, // ← CORRIGÉ: Utilise la constante centralisée
    instructions: "You are a biomedical conformity expert.",
    input: prompt,
    store: true,
  });

  const aiContent = completion.output_text ?? "";

  return safeParseConformity(aiContent);
}

function parseDateOrNull(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function toDecimalString(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number.toFixed(2) : null;
}

function toIntegerOrNull(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? Math.round(number) : null;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function similarityScoreBidirectional(a: string, b: string) {
  return Math.max(similarityScore(a, b), similarityScore(b, a));
}

function stringifyTechnicalRequirements(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((requirement) => {
      if (
        requirement &&
        typeof requirement === "object" &&
        "label" in requirement
      ) {
        return String(requirement.label);
      }

      return "";
    })
    .join(" ");
}

function getItemSearchText(item: {
  name: string;
  description: string | null;
  technicalRequirements?: unknown;
}) {
  return [
    item.name,
    item.description ?? "",
    stringifyTechnicalRequirements(item.technicalRequirements),
  ].join(" ");
}

function matchProformaLineToOfferItem(
  line: {
    lineNumber: number | null;
    designation: string;
    code: string | null;
  },
  items: {
    id: string;
    itemNumber: number;
    code: string | null;
    name: string;
    description: string | null;
    technicalRequirements?: unknown;
  }[],
) {
  const lineSearchText = [line.designation, line.code ?? ""].join(" ");
  const lineFamily = detectProductFamily(lineSearchText);

  if (line.code) {
    const byCode = items.find(
      (item) => item.code?.toLowerCase() === line.code?.toLowerCase(),
    );

    if (byCode) {
      return byCode;
    }
  }

  let bestMatch:
    | {
        item: (typeof items)[number];
        score: number;
      }
    | undefined;

  for (const item of items) {
    const itemSearchText = getItemSearchText(item);
    const itemFamily = detectProductFamily(itemSearchText);

    let score = similarityScoreBidirectional(lineSearchText, itemSearchText);

    const genericScore = genericEquivalenceScore(
      lineSearchText,
      itemSearchText,
    );

    score = Math.max(score, genericScore);

    const genericEquivalent = areGenericEquivalent(
      lineSearchText,
      itemSearchText,
    );

    if (genericEquivalent) {
      score += 0.25;
    }

    // Strong family bonus
    if (
      lineFamily !== "unknown" &&
      itemFamily !== "unknown" &&
      lineFamily === itemFamily
    ) {
      score += 0.25;
    }

    // Strong penalty for different families,
    // but do NOT destroy score if generic equivalence was detected.
    if (
      !genericEquivalent &&
      lineFamily !== "unknown" &&
      itemFamily !== "unknown" &&
      lineFamily !== itemFamily
    ) {
      score *= 0.15;
    }

    // Weak line number bonus only, never decisive alone
    if (line.lineNumber && item.itemNumber === line.lineNumber) {
      score += 0.05;
    }

    score = Math.min(score, 1);

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { item, score };
    }
  }

  if (bestMatch && bestMatch.score >= 0.45) {
    return bestMatch.item;
  }

  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

type SupplierItemAnalysisRow = typeof supplierItemAnalyses.$inferSelect;
type OfferItemRow = typeof offerItems.$inferSelect;

type AnalysisWithOfferItem = {
  analysis: SupplierItemAnalysisRow;
  offerItem: OfferItemRow;
};

function getEffectiveConformity(analysis: SupplierItemAnalysisRow) {
  if (analysis.manualOverride) {
    return Number(analysis.manualConformityPercentage ?? 0);
  }

  return Number(analysis.conformityPercentage ?? 0);
}

function isQuantitySufficient(analysis: SupplierItemAnalysisRow) {
  const requested = Number(analysis.quantityRequested ?? 0);
  const offered = Number(analysis.quantityOffered ?? 0);

  if (requested <= 0) {
    return true;
  }

  return offered >= requested;
}

function compareAnalysisCandidates(
  a: AnalysisWithOfferItem,
  b: AnalysisWithOfferItem,
) {
  const aConformity = getEffectiveConformity(a.analysis);
  const bConformity = getEffectiveConformity(b.analysis);

  const aQuantityOk = isQuantitySufficient(a.analysis);
  const bQuantityOk = isQuantitySufficient(b.analysis);

  const aCompliant = Boolean(a.analysis.isTechnicallyCompliant) && aQuantityOk;
  const bCompliant = Boolean(b.analysis.isTechnicallyCompliant) && bQuantityOk;

  if (aCompliant !== bCompliant) {
    return aCompliant ? 1 : -1;
  }

  if (aQuantityOk !== bQuantityOk) {
    return aQuantityOk ? 1 : -1;
  }

  if (aConformity !== bConformity) {
    return aConformity - bConformity;
  }

  const aPrice = Number(a.analysis.totalHT ?? 0);
  const bPrice = Number(b.analysis.totalHT ?? 0);

  if (aPrice > 0 && bPrice > 0 && aPrice !== bPrice) {
    return bPrice - aPrice;
  }

  return 0;
}

function selectBestAnalysisPerOfferItem(rows: AnalysisWithOfferItem[]) {
  const bestByOfferItem = new Map<string, AnalysisWithOfferItem>();

  for (const row of rows) {
    const current = bestByOfferItem.get(row.offerItem.id);

    if (!current || compareAnalysisCandidates(row, current) > 0) {
      bestByOfferItem.set(row.offerItem.id, row);
    }
  }

  return bestByOfferItem;
}

export async function recomputeOfferSupplierRanking(offerId: string) {
  await db
    .delete(supplierGlobalAnalyses)
    .where(eq(supplierGlobalAnalyses.offerId, offerId));

  const requestedItems = await db
    .select()
    .from(offerItems)
    .where(eq(offerItems.offerId, offerId));

  const responses = await db
    .select({
      response: supplierResponses,
      supplier: suppliers,
      proforma: supplierProformas,
    })
    .from(supplierResponses)
    .innerJoin(suppliers, eq(supplierResponses.supplierId, suppliers.id))
    .leftJoin(
      supplierProformas,
      eq(supplierProformas.supplierResponseId, supplierResponses.id),
    )
    .where(
      and(
        eq(supplierResponses.offerId, offerId),
        inArray(supplierResponses.status, ["analyzed", "needs_review"]),
        eq(supplierResponses.isNegativeResponse, false),
      ),
    );

  const candidates: {
    supplierResponseId: string;
    supplierId: string;
    technicalScore: number;
    priceScore: number;
    conditionsScore: number;
    globalScore: number;
    totalHT: number;
    totalTVA: number;
    totalTTC: number;
    isEligible: boolean;
    rejectionReason: string | null;
    summary: string;
  }[] = [];

  for (const row of responses) {
    const analyses = await db
      .select({
        analysis: supplierItemAnalyses,
        offerItem: offerItems,
      })
      .from(supplierItemAnalyses)
      .innerJoin(
        offerItems,
        eq(supplierItemAnalyses.offerItemId, offerItems.id),
      )
      .where(eq(supplierItemAnalyses.supplierResponseId, row.response.id));

    if (requestedItems.length === 0) {
      candidates.push({
        supplierResponseId: row.response.id,
        supplierId: row.supplier.id,
        technicalScore: 0,
        priceScore: 0,
        conditionsScore: 0,
        globalScore: 0,
        totalHT: Number(row.proforma?.totalHT ?? 0),
        totalTVA: Number(row.proforma?.totalTVA ?? 0),
        totalTTC: Number(row.proforma?.totalTTC ?? 0),
        isEligible: false,
        rejectionReason: "Aucun article demandé n'est défini.",
        summary: "Analyse impossible : articles du cahier des charges absents.",
      });

      continue;
    }

    const bestByOfferItem = selectBestAnalysisPerOfferItem(analyses);

    const selectedRows = requestedItems.map((item) => {
      return {
        offerItem: item,
        analysis: bestByOfferItem.get(item.id)?.analysis ?? null,
      };
    });

    const technicalScore =
      selectedRows.reduce((sum, item) => {
        if (!item.analysis) {
          return sum;
        }

        return sum + getEffectiveConformity(item.analysis);
      }, 0) / requestedItems.length;

    const totalHTFromSelectedAnalyses = selectedRows.reduce((sum, item) => {
      if (!item.analysis) {
        return sum;
      }

      return sum + Number(item.analysis.totalHT ?? 0);
    }, 0);

    const totalHT =
      totalHTFromSelectedAnalyses || Number(row.proforma?.totalHT ?? 0);

    const totalTVA = Number(row.proforma?.totalTVA ?? 0);
    const totalTTC = Number(row.proforma?.totalTTC ?? 0) || totalHT + totalTVA;

    const conditionsScore = calculateConditionsScore({
      validityDays: row.proforma?.validityDays ?? null,
      deliveryDelayDays: null,
      paymentTerms: row.proforma?.paymentTerms ?? null,
    });

    const blockingItems = selectedRows.filter((item) => {
      if (!item.analysis) {
        return true;
      }

      const minConformity = item.offerItem.minConformityPercentage ?? 70;
      const conformity = getEffectiveConformity(item.analysis);
      const quantityOk = isQuantitySufficient(item.analysis);

      return (
        conformity < minConformity ||
        Number(item.analysis.mandatoryMissingCount ?? 0) > 0 ||
        !item.analysis.isTechnicallyCompliant ||
        !quantityOk
      );
    });

    const missingItems = selectedRows.filter((item) => !item.analysis);
    const isEligible = blockingItems.length === 0;

    const rejectionReason = (() => {
      if (isEligible) {
        return null;
      }

      if (missingItems.length > 0) {
        return "Un ou plusieurs articles demandés ne sont pas proposés.";
      }

      return "Une ou plusieurs lignes ne respectent pas les exigences techniques ou les quantités demandées.";
    })();

    candidates.push({
      supplierResponseId: row.response.id,
      supplierId: row.supplier.id,
      technicalScore: round2(technicalScore),
      priceScore: 0,
      conditionsScore: round2(conditionsScore),
      globalScore: 0,
      totalHT: round2(totalHT),
      totalTVA: round2(totalTVA),
      totalTTC: round2(totalTTC),
      isEligible,
      rejectionReason,
      summary: isEligible
        ? "Fournisseur techniquement éligible."
        : "Fournisseur nécessitant une revue ou non éligible techniquement.",
    });
  }

  const validPrices = candidates
    .filter((candidate) => candidate.totalHT > 0)
    .map((candidate) => candidate.totalHT);

  const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;

  for (const candidate of candidates) {
    candidate.priceScore =
      minPrice > 0 && candidate.totalHT > 0
        ? round2((minPrice / candidate.totalHT) * 100)
        : 0;

    candidate.globalScore = round2(
      candidate.technicalScore * 0.5 +
        candidate.priceScore * 0.3 +
        candidate.conditionsScore * 0.2,
    );

    if (!candidate.isEligible) {
      candidate.globalScore = Math.min(candidate.globalScore, 49);
    }
  }

  const globalRanking = [...candidates].sort((a, b) => {
    if (a.isEligible !== b.isEligible) {
      return a.isEligible ? -1 : 1;
    }

    return b.globalScore - a.globalScore;
  });

  const moinsDisantRanking = [...candidates]
    .filter((candidate) => candidate.totalHT > 0)
    .sort((a, b) => a.totalHT - b.totalHT);

  const mieuxDisantRanking = [...candidates].sort((a, b) => {
    if (a.isEligible !== b.isEligible) {
      return a.isEligible ? -1 : 1;
    }

    if (a.technicalScore !== b.technicalScore) {
      return b.technicalScore - a.technicalScore;
    }

    return a.totalHT - b.totalHT;
  });

  for (let index = 0; index < globalRanking.length; index++) {
    const candidate = globalRanking[index];
    const moinsDisantRank =
      moinsDisantRanking.findIndex(
        (x) => x.supplierResponseId === candidate.supplierResponseId,
      ) + 1;

    const mieuxDisantRank =
      mieuxDisantRanking.findIndex(
        (x) => x.supplierResponseId === candidate.supplierResponseId,
      ) + 1;

    await db.insert(supplierGlobalAnalyses).values({
      supplierResponseId: candidate.supplierResponseId,
      offerId,
      supplierId: candidate.supplierId,
      technicalScore: candidate.technicalScore,
      priceScore: candidate.priceScore,
      conditionsScore: candidate.conditionsScore,
      globalScore: candidate.globalScore,
      totalHT: toDecimalString(candidate.totalHT),
      totalTVA: toDecimalString(candidate.totalTVA),
      totalTTC: toDecimalString(candidate.totalTTC),
      rank: index + 1,
      isBestSupplier:
        globalRanking.length > 0 &&
        globalRanking[0].supplierResponseId === candidate.supplierResponseId &&
        candidate.isEligible,
      isEligible: candidate.isEligible,
      rejectionReason: candidate.rejectionReason,
      summary: candidate.summary,
      analysisJson: {
        ...candidate,
        moinsDisantRank,
        mieuxDisantRank,
      },
    });
  }

  return {
    global: globalRanking,
    moinsDisant: moinsDisantRanking,
    mieuxDisant: mieuxDisantRanking,
  };
}

async function markResponseAsNeedsReview(
  supplierResponseId: string,
  reason: string,
) {
  await db
    .update(supplierResponses)
    .set({
      status: "needs_review",
      updatedAt: new Date(),
    })
    .where(eq(supplierResponses.id, supplierResponseId));

  console.warn("[PIPELINE NEEDS REVIEW]", {
    supplierResponseId,
    reason,
  });
}

async function createNotification(params: {
  type:
    | "negative_response"
    | "missing_documents"
    | "low_conformity"
    | "analysis_failed"
    | "manual_review_required";
  offerId: string;
  supplierId: string;
  supplierResponseId: string;
  title: string;
  message: string;
}) {
  await db.insert(notifications).values({
    type: params.type,
    offerId: params.offerId,
    supplierId: params.supplierId,
    supplierResponseId: params.supplierResponseId,
    title: params.title,
    message: params.message,
    isRead: false,
  });
}
