/**
 * best-offer-export.ts
 * Best offer selection, Excel generation, and missing-items reporting
 * with OpenAI-enhanced supplier intelligence.
 *
 * ← CORRIGÉ: N+1 fix - Utilise searchOnlineSuppliersBatch au lieu de boucle séquentielle
 */

import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../../../db/drizzle";
import {
  offers,
  offerItems,
  suppliers,
  supplierResponses,
  supplierItemAnalyses,
  supplierProformaLines,
  supplierProformas,
  medicalEntities,
} from "../../../db/schema";
import {
  searchOnlineSuppliersAI,
  searchOnlineSuppliersBatch, // ← AJOUTÉ: Import batch search
  type EnrichedSearchResult,
} from "./web-search";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type BestOfferLine = {
  rowNumber: number;
  supplierName: string | null;
  lot: number | null;
  product: string;
  unitPrice: number;
  quantity: number;
  requestedQuantity: number;
  marginRate: number;
  tvaRate: number;
  isOnlineSearch: boolean;
  onlineSuppliers: string[];
  conformityPercentage: number;
  isTechnicallyCompliant: boolean;
  originalSupplierPrice: number;
  aiRecommendations: string;
  unit?: string | null;
  hasTechnicalSheet?: boolean;
  dueDate?: string | null;
  deliveryDelay?: string | null;
  afterSalesService?: string | null;
  remarks?: string | null;
  selectionReason?: string | null;
  validityDays?: number | null;
  paymentTerms?: string | null;
};

export type BestOfferResult = {
  offerId: string;
  title: string;
  medicalEntityName: string | null;
  lines: BestOfferLine[];
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  missingItems: MissingItem[];
};

export type MissingItem = {
  itemNumber: number;
  itemName: string;
  onlineSuppliers: string[];
  aiRecommendations: string;
  classificationCategory: string;
};

// ─────────────────────────────────────────────
// 1. SELECT BEST SUPPLIER PER PRODUCT (CORRIGÉ N+1)
// ─────────────────────────────────────────────

export async function selectBestOffersForCahier(
  offerId: string,
  options: {
    marginRate?: number;
    tvaRate?: number;
    defaultQuantity?: number;
  } = {},
): Promise<BestOfferResult> {
  const marginRate = options.marginRate ?? 1.1;
  const tvaRate = options.tvaRate ?? 0.19;

  // ── 1. Load offer with medical entity ──
  const offer = await db.query.offers.findFirst({
    where: eq(offers.id, offerId),
    with: {
      medicalEntity: true,
      offerItems: {
        orderBy: offerItems.itemNumber,
      },
    },
  });

  if (!offer) {
    throw new Error("Offer not found");
  }

  const requestedItems = offer.offerItems || [];
  if (requestedItems.length === 0) {
    throw new Error("No items found in cahier des charges");
  }

  // ── 2. Load all supplier analyses for this offer ──
  const analyses = await db
    .select({
      analysis: supplierItemAnalyses,
      supplier: suppliers,
      offerItem: offerItems,
      proformaLine: supplierProformaLines,
      proforma: supplierProformas,
      response: supplierResponses,
    })
    .from(supplierItemAnalyses)
    .innerJoin(
      supplierResponses,
      eq(supplierItemAnalyses.supplierResponseId, supplierResponses.id),
    )
    .innerJoin(suppliers, eq(supplierResponses.supplierId, suppliers.id))
    .innerJoin(offerItems, eq(supplierItemAnalyses.offerItemId, offerItems.id))
    .leftJoin(
      supplierProformaLines,
      eq(supplierItemAnalyses.proformaLineId, supplierProformaLines.id),
    )
    .leftJoin(
      supplierProformas,
      eq(supplierProformas.supplierResponseId, supplierResponses.id),
    )
    .where(
      and(
        eq(supplierResponses.offerId, offerId),
        inArray(supplierItemAnalyses.status, ["completed", "needs_review"]),
      ),
    );

  const analysesByItem = new Map<string, typeof analyses>();
  for (const row of analyses) {
    const itemId = row.offerItem.id;
    if (!analysesByItem.has(itemId)) {
      analysesByItem.set(itemId, []);
    }
    analysesByItem.get(itemId)!.push(row);
  }

  // ── 3. Load raw proforma lines for items without AI analysis ──
  const rawLines = await db
    .select({
      line: supplierProformaLines,
      supplier: suppliers,
      offerItem: offerItems,
      proforma: supplierProformas,
      response: supplierResponses,
    })
    .from(supplierProformaLines)
    .innerJoin(
      supplierProformas,
      eq(supplierProformaLines.proformaId, supplierProformas.id),
    )
    .innerJoin(
      supplierResponses,
      eq(supplierProformas.supplierResponseId, supplierResponses.id),
    )
    .innerJoin(suppliers, eq(supplierResponses.supplierId, suppliers.id))
    .leftJoin(offerItems, eq(supplierProformaLines.offerItemId, offerItems.id))
    .where(eq(supplierResponses.offerId, offerId));

  const rawLinesByItem = new Map<string, typeof rawLines>();
  for (const row of rawLines) {
    if (!row.offerItem) continue;
    const itemId = row.offerItem.id;
    if (!rawLinesByItem.has(itemId)) {
      rawLinesByItem.set(itemId, []);
    }
    rawLinesByItem.get(itemId)!.push(row);
  }

  // ── 4. Pick best offer per item ──
  const lines: BestOfferLine[] = [];
  const missingItems: MissingItem[] = [];

  // ← CORRIGÉ: Collecter les items manquants pour recherche batch
  const itemsNeedingSearch: Array<{ id: string; name: string; index: number }> =
    [];

  for (let idx = 0; idx < requestedItems.length; idx++) {
    const item = requestedItems[idx];
    const itemAnalyses = analysesByItem.get(item.id) || [];
    const itemRawLines = rawLinesByItem.get(item.id) || [];

    let selected = await selectBestSupplierForItem(
      item,
      itemAnalyses,
      itemRawLines,
    );

    if (selected) {
      lines.push({
        rowNumber: idx + 1,
        supplierName: selected.supplierName,
        lot: item.itemNumber,
        product: item.name,
        unitPrice: selected.unitPrice,
        quantity: selected.quantity,
        requestedQuantity: item.requestedQuantity,
        marginRate,
        tvaRate,
        isOnlineSearch: false,
        onlineSuppliers: [],
        conformityPercentage: selected.conformity,
        isTechnicallyCompliant: selected.isCompliant,
        originalSupplierPrice: selected.unitPrice,
        aiRecommendations: "",
        unit: null,
        hasTechnicalSheet: selected.hasTechnicalSheet,
        dueDate: selected.dueDate,
        deliveryDelay: selected.deliveryDelay,
        afterSalesService: selected.afterSalesService,
        remarks: selected.remarks,
        validityDays: selected.validityDays,
        paymentTerms: selected.paymentTerms,
      });
    } else {
      // ← CORRIGÉ: Collecter pour recherche batch au lieu de await immédiat
      itemsNeedingSearch.push({ id: item.id, name: item.name, index: idx });
    }
  }

  // ── 5. RECHERCHE WEB BATCH POUR ITEMS MANQUANTS ──
  // ← CORRIGÉ: Utilise searchOnlineSuppliersBatch au lieu de boucle séquentielle
  if (itemsNeedingSearch.length > 0) {
    console.log(
      `[BEST OFFER] ${itemsNeedingSearch.length} items need web search, using batch...`,
    );

    const searchResults = await searchOnlineSuppliersBatch(
      itemsNeedingSearch.map((i) => ({ id: i.id, name: i.name })),
      8,
    );

    for (const { id, name, index } of itemsNeedingSearch) {
      const enriched = searchResults.get(id);

      if (enriched) {
        const aiRecText = enriched.aiRecommendations
          .map(
            (r: any) =>
              `• ${r.name} [${r.likelihood.toUpperCase()}]: ${r.reason}`,
          )
          .join("\n");

        missingItems.push({
          itemNumber: requestedItems[index].itemNumber ?? index + 1,
          itemName: name,
          onlineSuppliers: enriched.suppliers,
          aiRecommendations: aiRecText,
          classificationCategory: enriched.classification.category,
        });

        lines.push({
          rowNumber: index + 1,
          supplierName: "À RECHERCHER",
          lot: requestedItems[index].itemNumber,
          product: name,
          unitPrice: 0,
          quantity: requestedItems[index].requestedQuantity || 1,
          requestedQuantity: requestedItems[index].requestedQuantity || 1,
          marginRate,
          tvaRate,
          isOnlineSearch: true,
          onlineSuppliers: enriched.suppliers,
          conformityPercentage: 0,
          isTechnicallyCompliant: false,
          originalSupplierPrice: 0,
          aiRecommendations: aiRecText,
          unit: null,
          hasTechnicalSheet: false,
          dueDate: null,
          deliveryDelay: null,
          afterSalesService: null,
          remarks: "Fournisseur non trouvé - recherche web effectuée",
          validityDays: null,
          paymentTerms: null,
        });
      }
    }
  }

  // ── 6. Calculate totals ──
  const totalHT = lines.reduce(
    (sum, l) => sum + l.unitPrice * l.marginRate * l.quantity,
    0,
  );
  const totalTVA = totalHT * tvaRate;
  const totalTTC = totalHT + totalTVA;

  return {
    offerId,
    title: offer.title || offer.medicalEntity?.name || "Comparatif Prix",
    medicalEntityName: offer.medicalEntity?.name ?? null,
    lines,
    totalHT,
    totalTVA,
    totalTTC,
    missingItems,
  };
}

// ── Helper: Sélection du meilleur fournisseur pour un item ──
async function selectBestSupplierForItem(
  item: typeof offerItems.$inferSelect,
  itemAnalyses: any[],
  itemRawLines: any[],
) {
  let selected: {
    supplierName: string;
    unitPrice: number;
    quantity: number;
    conformity: number;
    isCompliant: boolean;
    source: "ai_analysis" | "raw_proforma";
    deliveryDelay: string | null;
    afterSalesService: string | null;
    remarks: string | null;
    validityDays: number | null;
    paymentTerms: string | null;
    hasTechnicalSheet: boolean;
    dueDate: string | null;
  } | null = null;

  // Priority 1: AI-analyzed compliant suppliers
  const compliantAnalyses = itemAnalyses.filter((a) => {
    const minConf = a.offerItem.minConformityPercentage ?? 70;
    const conf = a.analysis.manualOverride
      ? Number(a.analysis.manualConformityPercentage ?? 0)
      : Number(a.analysis.conformityPercentage ?? 0);
    const requestedQty = Number(a.offerItem.requestedQuantity ?? 1);
    const offeredQty = Number(a.analysis.quantityOffered ?? 0);
    const quantityOk =
      offeredQty >= requestedQty || a.analysis.quantityOffered === null;
    return a.analysis.isTechnicallyCompliant && conf >= minConf && quantityOk;
  });

  if (compliantAnalyses.length > 0) {
    const best = compliantAnalyses.sort((a, b) => {
      const priceA = Number(a.analysis.unitPriceHT ?? Infinity);
      const priceB = Number(b.analysis.unitPriceHT ?? Infinity);
      if (priceA !== priceB) return priceA - priceB;
      const confA = Number(a.analysis.conformityPercentage ?? 0);
      const confB = Number(b.analysis.conformityPercentage ?? 0);
      return confB - confA;
    })[0];

    selected = {
      supplierName: best.supplier.name,
      unitPrice: Number(best.analysis.unitPriceHT ?? 0),
      quantity: best.analysis.quantityOffered ?? item.requestedQuantity ?? 1,
      conformity: Number(best.analysis.conformityPercentage ?? 0),
      isCompliant: true,
      source: "ai_analysis",
      deliveryDelay: best.response.deliveryDelay,
      afterSalesService: best.response.afterSalesService,
      remarks: best.response.remarks,
      validityDays: best.proforma?.validityDays,
      paymentTerms: best.proforma?.paymentTerms,
      hasTechnicalSheet: await checkTechnicalSheet(
        best.analysis.supplierResponseId,
        item.id,
      ),
      dueDate: best.proforma?.validityText
        ? `Validité: ${best.proforma.validityDays} jours`
        : null,
    };
  }
  // Priority 2: Any AI analysis
  else if (itemAnalyses.length > 0) {
    const best = itemAnalyses.sort(
      (a, b) =>
        Number(b.analysis.conformityPercentage ?? 0) -
        Number(a.analysis.conformityPercentage ?? 0),
    )[0];

    selected = {
      supplierName: best.supplier.name,
      unitPrice: Number(best.analysis.unitPriceHT ?? 0),
      quantity: best.analysis.quantityOffered ?? item.requestedQuantity ?? 1,
      conformity: Number(best.analysis.conformityPercentage ?? 0),
      isCompliant: false,
      source: "ai_analysis",
      deliveryDelay: best.response.deliveryDelay,
      afterSalesService: best.response.afterSalesService,
      remarks: best.response.remarks,
      validityDays: best.proforma?.validityDays,
      paymentTerms: best.proforma?.paymentTerms,
      hasTechnicalSheet: await checkTechnicalSheet(
        best.analysis.supplierResponseId,
        item.id,
      ),
      dueDate: best.proforma?.validityText
        ? `Validité: ${best.proforma.validityDays} jours`
        : null,
    };
  }
  // Priority 3: Raw proforma lines
  else if (itemRawLines.length > 0) {
    const best = itemRawLines.sort(
      (a, b) =>
        Number(a.line.unitPriceHT ?? Infinity) -
        Number(b.line.unitPriceHT ?? Infinity),
    )[0];

    selected = {
      supplierName: best.supplier.name,
      unitPrice: Number(best.line.unitPriceHT ?? 0),
      quantity: Number(best.line.quantity ?? item.requestedQuantity ?? 1),
      conformity: 0,
      isCompliant: false,
      source: "raw_proforma",
      deliveryDelay: best.response.deliveryDelay,
      afterSalesService: best.response.afterSalesService,
      remarks: best.response.remarks,
      validityDays: best.proforma?.validityDays,
      paymentTerms: best.proforma?.paymentTerms,
      hasTechnicalSheet: false,
      dueDate: best.proforma?.validityText
        ? `Validité: ${best.proforma.validityDays} jours`
        : null,
    };
  }

  return selected;
}

// ── Helper: Vérifier fiche technique ──
async function checkTechnicalSheet(
  supplierResponseId: string,
  offerItemId: string,
): Promise<boolean> {
  const { supplierResponseAttachments } = await import("../../../db/schema");
  const attachments = await db
    .select()
    .from(supplierResponseAttachments)
    .where(
      and(
        eq(supplierResponseAttachments.supplierResponseId, supplierResponseId),
        eq(supplierResponseAttachments.attachmentType, "technical_sheet"),
      ),
    );
  return attachments.length > 0;
}

// ─────────────────────────────────────────────
// 2. EXCEL GENERATION (Exact Reference Format)
// ─────────────────────────────────────────────

export async function generateBestOfferExcel(
  result: BestOfferResult,
): Promise<{ fileName: string; filePath: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Digitservz";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Classement");

  // ── Column widths (matching reference exactly) ──
  worksheet.columns = [
    { key: "number", width: 6 },
    { key: "supplier", width: 22 },
    { key: "marginRate", width: 12 },
    { key: "lot", width: 16 },
    { key: "product", width: 42 },
    { key: "unit", width: 10 },
    { key: "unitPrice", width: 15 },
    { key: "requestedQty", width: 12 },
    { key: "offeredQty", width: 12 },
    { key: "unitPriceMargin", width: 18 },
    { key: "totalHT", width: 18 },
    { key: "tvaRate", width: 12 },
    { key: "tvaAmount", width: 18 },
    { key: "totalTTC", width: 18 },
    { key: "conformity", width: 14 },
    { key: "techSheet", width: 16 },
    { key: "dueDate", width: 18 },
    { key: "delivery", width: 18 },
    { key: "sav", width: 20 },
    { key: "remarks", width: 30 },
  ];

  // ── Row heights ──
  worksheet.getRow(1).height = 18;
  worksheet.getRow(2).height = 18;
  worksheet.getRow(3).height = 18;

  // ── Title row (Row 4) ──
  worksheet.mergeCells("D4:E4");
  const titleCell = worksheet.getCell("D4");
  titleCell.value = result.medicalEntityName || result.title || "CHU";
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.font = { bold: true, size: 10 };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "C6E0B4" },
  };

  worksheet.mergeCells("F4:G4");
  worksheet.getCell("F4").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFF00" },
  };

  worksheet.getCell("I4").value = "TOTAL H T";
  worksheet.getCell("I4").alignment = {
    horizontal: "center",
    vertical: "middle",
  };
  worksheet.getCell("I4").font = { bold: true, size: 9 };
  worksheet.getCell("I4").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "D9A6A6" },
  };

  worksheet.mergeCells("K4:L4");
  worksheet.getCell("K4").value = "TOTAL TTC";
  worksheet.getCell("K4").alignment = {
    horizontal: "center",
    vertical: "middle",
  };
  worksheet.getCell("K4").font = { bold: true, size: 9 };
  worksheet.getCell("K4").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "D9D2E9" },
  };

  // ── Sub-headers row (Row 5) ──
  worksheet.getCell("F5").value = "Qtè";
  worksheet.getCell("F5").alignment = {
    horizontal: "center",
    vertical: "middle",
  };
  worksheet.getCell("F5").font = { bold: true, size: 9 };

  // ── Header row (Row 6) ──
  const headerRowNumber = 6;
  const headers = [
    "N°",
    "FOURNISSEUR",
    "LOT",
    "PRODUIT",
    "UNITÉ",
    "PRIX U",
    "QTÉ DEMANDÉE",
    "QTÉ OFFERTE",
    "Marge",
    "Prix U / Marge",
    "TOTAL HT",
    "TVA",
    "MONTANT TVA",
    "TOTAL TTC",
    "% CONFORMITÉ",
    "FICHE TECH.",
    "ÉCHÉANCE",
    "DÉLAI LIVRAISON",
    "SAV",
    "REMARQUES",
  ];

  headers.forEach((h, idx) => {
    const cell = worksheet.getCell(headerRowNumber, idx + 1);
    cell.value = h;
    cell.font = { bold: true, size: 8 };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = borderStyle();
  });
  worksheet.getRow(headerRowNumber).height = 32;

  // ── Data rows ──
  const startRow = headerRowNumber + 1;

  result.lines.forEach((line, index) => {
    const rowNumber = startRow + index;
    const row = worksheet.getRow(rowNumber);

    const unitPriceWithMargin = line.unitPrice * line.marginRate;
    const totalHT = unitPriceWithMargin * line.quantity;
    const tvaAmount = totalHT * line.tvaRate;
    const totalTTC = totalHT + tvaAmount;

    const isMissing = line.isOnlineSearch;

    row.values = [
      line.rowNumber,
      line.supplierName ?? "",
      line.lot ?? "",
      line.product,
      line.unit ?? "",
      isMissing ? 0 : line.unitPrice,
      line.requestedQuantity,
      line.quantity,
      line.marginRate,
      {
        formula: `F${rowNumber}*I${rowNumber}`,
        result: isMissing ? 0 : unitPriceWithMargin,
      },
      {
        formula: `J${rowNumber}*H${rowNumber}`,
        result: isMissing ? 0 : totalHT,
      },
      line.tvaRate,
      {
        formula: `K${rowNumber}*L${rowNumber}`,
        result: isMissing ? 0 : tvaAmount,
      },
      {
        formula: `K${rowNumber}+M${rowNumber}`,
        result: isMissing ? 0 : totalTTC,
      },
      isMissing ? "N/A" : `${line.conformityPercentage}%`,
      line.hasTechnicalSheet ? "Existe" : "Non",
      line.dueDate ?? "—",
      line.deliveryDelay ?? "—",
      line.afterSalesService ?? "—",
      line.remarks ?? "",
    ];

    row.height = 22;

    for (let col = 1; col <= 20; col++) {
      const cell = worksheet.getCell(rowNumber, col);
      cell.border = borderStyle();
      cell.alignment = {
        vertical: "middle",
        horizontal: col === 4 ? "left" : "center",
        wrapText: true,
      };
      cell.font = { size: 9 };

      // Quantité insuffisante en rouge
      if (line.quantity < line.requestedQuantity) {
        for (let qc = 7; qc <= 8; qc++) {
          const qtyCell = worksheet.getCell(rowNumber, qc);
          qtyCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF6B6B" },
          };
          qtyCell.font = { bold: true, color: { argb: "FFFFFF" } };
        }
      }

      // Item manquant en jaune
      if (isMissing) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF2CC" },
        };
      }

      // Fiche technique manquante en rouge italique
      if (col === 16 && !line.hasTechnicalSheet && !isMissing) {
        cell.font = { color: { argb: "C00000" }, italic: true };
      }

      // Conformité basse en orange
      if (col === 15 && !isMissing && line.conformityPercentage < 70) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "F4CCCC" },
        };
        cell.font = { color: { argb: "C00000" }, bold: true };
      }
    }

    // Formats numériques
    worksheet.getCell(`F${rowNumber}`).numFmt = "#,##0.00";
    worksheet.getCell(`H${rowNumber}`).numFmt = "0.0";
    worksheet.getCell(`I${rowNumber}`).numFmt = "#,##0.00";
    worksheet.getCell(`J${rowNumber}`).numFmt = "#,##0.00";
    worksheet.getCell(`L${rowNumber}`).numFmt = "0%";
    worksheet.getCell(`M${rowNumber}`).numFmt = "#,##0.00";
    worksheet.getCell(`N${rowNumber}`).numFmt = "#,##0.00";
  });

  // ── Total rows ──
  const lastDataRow = startRow + result.lines.length - 1;
  const totalRowNumber = lastDataRow + 1;

  worksheet.getCell(`I${totalRowNumber}`).value = "HT";
  worksheet.getCell(`I${totalRowNumber}`).font = { bold: true, size: 9 };
  worksheet.getCell(`I${totalRowNumber}`).alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  worksheet.getCell(`J${totalRowNumber}`).value = {
    formula: `SUM(J${startRow}:J${lastDataRow})`,
  };
  worksheet.getCell(`J${totalRowNumber}`).numFmt = "#,##0.00";

  worksheet.getCell(`L${totalRowNumber}`).value = "TVA";
  worksheet.getCell(`L${totalRowNumber}`).font = { bold: true, size: 9 };
  worksheet.getCell(`L${totalRowNumber}`).alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  worksheet.getCell(`M${totalRowNumber}`).value = {
    formula: `SUM(M${startRow}:M${lastDataRow})`,
  };
  worksheet.getCell(`M${totalRowNumber}`).numFmt = "#,##0.00";

  worksheet.getCell(`N${totalRowNumber}`).value = {
    formula: `SUM(N${startRow}:N${lastDataRow})`,
  };
  worksheet.getCell(`N${totalRowNumber}`).numFmt = "#,##0.00";

  const ttcRowNumber = totalRowNumber + 1;
  worksheet.getCell(`I${ttcRowNumber}`).value = "TTC";
  worksheet.getCell(`I${ttcRowNumber}`).font = { bold: true, size: 9 };
  worksheet.getCell(`I${ttcRowNumber}`).alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  worksheet.getCell(`J${ttcRowNumber}`).value = {
    formula: `J${totalRowNumber}+M${totalRowNumber}`,
  };
  worksheet.getCell(`J${ttcRowNumber}`).numFmt = "#,##0.00";

  const sumMarginRow = ttcRowNumber + 1;
  worksheet.getCell(`I${sumMarginRow}`).value = {
    formula: `SUM(I${startRow}:I${lastDataRow})`,
  };
  worksheet.getCell(`I${sumMarginRow}`).numFmt = "#,##0.00";

  for (const rowNum of [totalRowNumber, ttcRowNumber]) {
    for (let col = 9; col <= 14; col++) {
      const cell = worksheet.getCell(rowNum, col);
      cell.border = borderStyle();
      cell.font = { bold: true, size: 9 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    }
  }

  worksheet.getCell(`M${totalRowNumber}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF2CC" },
  };
  worksheet.getCell(`N${totalRowNumber}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "F4CCCC" },
  };
  worksheet.getCell(`M${totalRowNumber}`).font = {
    bold: true,
    color: { argb: "C00000" },
  };
  worksheet.getCell(`N${totalRowNumber}`).font = {
    bold: true,
    color: { argb: "C00000" },
  };

  worksheet.views = [{ state: "frozen", ySplit: 6 }];

  // ── Save ──
  const folder = path.join("uploads", "exports", result.offerId);
  await fs.mkdir(folder, { recursive: true });

  const fileName = `classement-meilleur-offre-${result.offerId}.xlsx`;
  const filePath = path.join(folder, fileName);

  await workbook.xlsx.writeFile(filePath);

  return { fileName, filePath };
}

// ─────────────────────────────────────────────
// 3. MISSING ITEMS SHEET (AI-Enriched)
// ─────────────────────────────────────────────

export async function generateMissingItemsSheet(
  workbook: ExcelJS.Workbook,
  missingItems: MissingItem[],
) {
  if (missingItems.length === 0) return;

  const ws = workbook.addWorksheet("Fournisseurs Manquants");

  ws.columns = [
    { header: "N° Lot", key: "lot", width: 12 },
    { header: "Produit", key: "product", width: 35 },
    { header: "Catégorie IA", key: "category", width: 18 },
    { header: "Fournisseurs Web", key: "suppliers", width: 40 },
    { header: "Recommandations IA", key: "aiRec", width: 55 },
  ];

  // Header styling
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, size: 10, color: { argb: "FFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "2E75B6" },
  };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };

  for (const item of missingItems) {
    const row = ws.addRow({
      lot: item.itemNumber,
      product: item.itemName,
      category: item.classificationCategory,
      suppliers: item.onlineSuppliers.join(", "),
      aiRec: item.aiRecommendations || "—",
    });

    row.height = 40;
    row.alignment = { vertical: "top", wrapText: true };
    row.getCell(4).alignment = { vertical: "top", wrapText: true };
    row.getCell(5).alignment = { vertical: "top", wrapText: true };
  }

  ws.autoFilter = { from: "A1", to: "E1" };
}

// ─────────────────────────────────────────────
// 4. MAIN EXPORT FUNCTION
// ─────────────────────────────────────────────

export async function generateBestOfferExport(offerId: string) {
  const result = await selectBestOffersForCahier(offerId);
  const { fileName, filePath } = await generateBestOfferExcel(result);

  if (result.missingItems.length > 0) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    await generateMissingItemsSheet(workbook, result.missingItems);
    await workbook.xlsx.writeFile(filePath);
  }

  return {
    fileName,
    filePath,
    fileUrl: `/api/excel/download/${offerId}/${fileName}`,
    summary: {
      totalItems: result.lines.length,
      matchedItems: result.lines.filter((l) => !l.isOnlineSearch).length,
      missingItems: result.missingItems.length,
      totalHT: result.totalHT,
      totalTVA: result.totalTVA,
      totalTTC: result.totalTTC,
    },
    missingItems: result.missingItems.map((m) => ({
      itemNumber: m.itemNumber,
      itemName: m.itemName,
      category: m.classificationCategory,
      suppliersFound: m.onlineSuppliers.length,
    })),
  };
}

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────

function borderStyle(): Partial<ExcelJS.Borders> {
  return {
    top: { style: "thin", color: { argb: "000000" } },
    left: { style: "thin", color: { argb: "000000" } },
    bottom: { style: "thin", color: { argb: "000000" } },
    right: { style: "thin", color: { argb: "000000" } },
  };
}
