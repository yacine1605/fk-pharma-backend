import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../../db/drizzle";
import {
  offerItems,
  offers,
  supplierGlobalAnalyses,
  supplierItemAnalyses,
  supplierProformas,
  supplierProformaLines,
  supplierResponseAttachments,
  supplierResponses,
  suppliers,
} from "../../../db/schema";
import {
  ComparisonExcelRow,
  ComparisonExcelOptions,
  generateComparisonExcel,
} from "./comparisonExcel";

// ─────────────────────────────────────────────
// MAIN SERVICE ENTRY POINT
// ─────────────────────────────────────────────

/**
 * Builds and writes the comparison Excel for a given offer.
 * Fetches all required data from the DB, resolves moins/mieux disant flags,
 * and includes all spec columns: délai livraison, SAV, échéance, unité.
 */
export async function buildAndExportComparisonExcel(
  offerId: string,
): Promise<{ filePath: string; rowCount: number }> {
  const offer = await db.query.offers.findFirst({
    where: eq(offers.id, offerId),
    with: {
      offerItems: true,
      medicalEntity: true,
      lots: true,
    },
  });

  if (!offer) {
    throw new Error(`Offer ${offerId} not found`);
  }

  // All analyzed/needs_review responses (non-negative)
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

  if (responses.length === 0) {
    throw new Error("No analyzed supplier responses found for this offer");
  }

  // Global analyses for moins/mieux disant flags
  const globalAnalyses = await db
    .select()
    .from(supplierGlobalAnalyses)
    .where(eq(supplierGlobalAnalyses.offerId, offerId));

  const moinsDisantResponseId = resolveMoinsDisant(globalAnalyses);
  const mieuxDisantResponseId = resolveMieuxDisant(globalAnalyses);

  // Item analyses per response
  const allItemAnalyses = await db
    .select({
      analysis: supplierItemAnalyses,
      offerItem: offerItems,
      proformaLine: supplierProformaLines,
    })
    .from(supplierItemAnalyses)
    .innerJoin(offerItems, eq(supplierItemAnalyses.offerItemId, offerItems.id))
    .leftJoin(
      supplierProformaLines,
      eq(supplierItemAnalyses.proformaLineId, supplierProformaLines.id),
    )
    .where(
      inArray(
        supplierItemAnalyses.supplierResponseId,
        responses.map((r) => r.response.id),
      ),
    );

  // Technical sheet presence per response
  const technicalAttachments = await db
    .select({
      supplierResponseId: supplierResponseAttachments.supplierResponseId,
      attachmentType: supplierResponseAttachments.attachmentType,
    })
    .from(supplierResponseAttachments)
    .where(
      and(
        inArray(
          supplierResponseAttachments.supplierResponseId,
          responses.map((r) => r.response.id),
        ),
        inArray(supplierResponseAttachments.attachmentType, [
          "technical_sheet",
          "catalog",
        ]),
      ),
    );

  const technicalSheetByResponse = new Set(
    technicalAttachments.map((a) => a.supplierResponseId),
  );

  // Build rows
  const rows: ComparisonExcelRow[] = [];

  for (const { response, supplier, proforma } of responses) {
    const responseAnalyses = allItemAnalyses.filter(
      (a) => a.analysis.supplierResponseId === response.id,
    );

    const hasTechnicalSheet = technicalSheetByResponse.has(response.id);
    const isLeastExpensive = response.id === moinsDisantResponseId;
    const isBestValue = response.id === mieuxDisantResponseId;

    for (const { analysis, offerItem, proformaLine } of responseAnalyses) {
      const conformityPercentage =
        analysis.manualOverride && analysis.manualConformityPercentage !== null
          ? Number(analysis.manualConformityPercentage)
          : Number(analysis.conformityPercentage ?? 0);

      const unitPriceHT = Number(
        proformaLine?.unitPriceHT ?? analysis.unitPriceHT ?? 0,
      );
      const totalHT = Number(proformaLine?.totalHT ?? analysis.totalHT ?? 0);
      const tvaRate = Number(
        proformaLine?.tvaPercentage ?? analysis.tvaPercentage ?? 0,
      );
      const totalTTC = totalHT * (1 + tvaRate / 100);

      // Delivery delay — prefer proforma > response > offer
      const deliveryDelayText = proforma?.paymentTerms
        ? null
        : (response.deliveryDelay ?? offer.deliveryDelay ?? null);

      const deliveryDelayDays = extractDaysFromText(
        response.deliveryDelay ?? offer.deliveryDelay,
      );

      // Warranty — prefer response > offer
      const warrantyText =
        response.warrantyDuration ?? offer.warrantyDuration ?? null;
      const warrantyMonths = extractMonthsFromText(warrantyText);

      // SAV — prefer response > offer
      const afterSalesService =
        response.afterSalesService ??
        buildSavText(offer.savDuration, offer.savLocations) ??
        null;

      // Échéance — technicalDepartmentDepositDate from offer
      const echeance = offer.technicalDepartmentDepositDate ?? null;

      rows.push({
        product: offerItem.name,
        lot: offer.lots?.[0]?.lotNumber ?? offer.lots?.[0]?.lotObject ?? "-",
        quantity: offerItem.requestedQuantity,
        unit: null, // not stored on offerItem; left as "U" by default in Excel

        supplierName: supplier.name,

        unitPriceHT,
        tvaRate,
        totalHT,
        totalTTC,

        conformityPercentage,
        technicalSheetStatus: hasTechnicalSheet ? "existe" : "non_existe",

        isLeastExpensive,
        isBestValue,

        deliveryDelayDays,
        deliveryDelayText,
        warrantyMonths,
        warrantyText,
        afterSalesService,
        paymentTerms: proforma?.paymentTerms ?? null,
        validityDays: proforma?.validityDays ?? null,
        echeance,
      });
    }
  }

  // Sort: by product name, then by totalHT ascending
  rows.sort((a, b) => {
    const nameCompare = a.product.localeCompare(b.product, "fr");
    if (nameCompare !== 0) return nameCompare;
    return a.totalHT - b.totalHT;
  });

  const filePath = await generateComparisonExcel({
    offerId,
    title: buildTitle({
      ...offer,
      lotNumber: offer.lots?.[0]?.lotNumber ?? null,
    }),
    rows,
    offerMeta: {
      consultationNumber: offer.consultationNumber,
      establishment: offer.establishment ?? offer.medicalEntity?.name,
      lotNumber: offer.lots?.[0]?.lotNumber ?? null,
      lotObject: offer.lots?.[0]?.lotObject ?? null,
      technicalDepartmentDepositDate: offer.technicalDepartmentDepositDate,
    },
  });

  return { filePath, rowCount: rows.length };
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function resolveMoinsDisant(
  globalAnalyses: (typeof supplierGlobalAnalyses.$inferSelect)[],
): string | null {
  const eligible = globalAnalyses.filter((a) => Number(a.totalHT) > 0);
  if (eligible.length === 0) return null;
  const sorted = [...eligible].sort(
    (a, b) => Number(a.totalHT) - Number(b.totalHT),
  );
  return sorted[0].supplierResponseId;
}

function resolveMieuxDisant(
  globalAnalyses: (typeof supplierGlobalAnalyses.$inferSelect)[],
): string | null {
  const eligible = globalAnalyses.filter((a) => a.isEligible);
  if (eligible.length === 0) {
    // Fallback: highest global score regardless of eligibility
    const sorted = [...globalAnalyses].sort(
      (a, b) => Number(b.globalScore) - Number(a.globalScore),
    );
    return sorted[0]?.supplierResponseId ?? null;
  }
  const sorted = [...eligible].sort(
    (a, b) => Number(b.globalScore) - Number(a.globalScore),
  );
  return sorted[0].supplierResponseId;
}

function extractDaysFromText(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.match(/(\d+)\s*(j|jour|jours|days?)/i);
  if (match) return Number(match[1]);
  // plain number fallback
  const num = Number(text.replace(/[^\d]/g, ""));
  return Number.isFinite(num) && num > 0 ? num : null;
}

function extractMonthsFromText(text: string | null | undefined): number | null {
  if (!text) return null;
  const monthMatch = text.match(/(\d+)\s*(mois|months?)/i);
  if (monthMatch) return Number(monthMatch[1]);
  const yearMatch = text.match(/(\d+)\s*(an|ans|year|years)/i);
  if (yearMatch) return Number(yearMatch[1]) * 12;
  return null;
}

function buildSavText(
  duration: string | null | undefined,
  locations: string | null | undefined,
): string | null {
  const parts = [
    duration ? `Durée: ${duration}` : null,
    locations ? `Lieux: ${locations}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" | ") : null;
}

function buildTitle(offer: {
  title?: string;
  consultationNumber?: string | null;
  establishment?: string | null;
  lotNumber?: string | null;
}): string {
  const parts = [
    "Tableau de comparaison des offres",
    offer.consultationNumber
      ? `— Consultation ${offer.consultationNumber}`
      : null,
    offer.establishment ? `— ${offer.establishment}` : null,
    offer.lotNumber ? `— Lot ${offer.lotNumber}` : null,
  ].filter(Boolean);
  return parts.join(" ");
}
