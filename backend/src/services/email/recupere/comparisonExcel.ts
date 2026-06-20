import ExcelJS from "exceljs";
import path from "path";
import fs from "fs/promises";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type ComparisonExcelRow = {
  // Identité produit
  product: string;
  lot: string;
  quantity: number;
  unit: string | null;

  // Fournisseur
  supplierName: string;

  // Prix
  unitPriceHT: number;
  tvaRate: number;
  totalHT: number;
  totalTTC: number;

  // Analyse technique
  conformityPercentage: number | null;
  technicalSheetStatus: "existe" | "non_existe";

  // Classements
  isLeastExpensive: boolean;
  isBestValue: boolean;

  // Conditions (nouveaux champs spec étape 5)
  deliveryDelayDays: number | null;
  deliveryDelayText: string | null;
  warrantyMonths: number | null;
  warrantyText: string | null;
  afterSalesService: string | null;
  paymentTerms: string | null;
  validityDays: number | null;

  // Calendrier offre
  echeance: Date | string | null;
};

export type ComparisonExcelOptions = {
  offerId: string;
  title: string;
  rows: ComparisonExcelRow[];
  offerMeta?: {
    consultationNumber?: string | null;
    establishment?: string | null;
    lotNumber?: string | null;
    lotObject?: string | null;
    technicalDepartmentDepositDate?: Date | null;
  };
};

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────

const COLORS = {
  headerBg: "2E4057", // bleu marine pro
  headerFg: "FFFFFF",
  subHeaderBg: "4472C4", // bleu section
  subHeaderFg: "FFFFFF",
  sectionPriceBg: "EBF2FF",
  sectionTechBg: "F0FFF4",
  sectionCondBg: "FFF9E6",
  rowAlt: "F7F9FC",
  green: "C6E0B4",
  greenText: "1E6634",
  amber: "FFD966",
  amberText: "7D5A00",
  red: "FFDCE0",
  redText: "C00000",
  border: "BDD7EE",
  muted: "888888",
} as const;

function headerStyle(
  ws: ExcelJS.Worksheet,
  cell: ExcelJS.Cell,
  bg = COLORS.headerBg,
  fg = COLORS.headerFg,
) {
  cell.font = { bold: true, color: { argb: fg }, size: 10, name: "Arial" };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = {
    top: { style: "thin", color: { argb: COLORS.border } },
    bottom: { style: "thin", color: { argb: COLORS.border } },
    left: { style: "thin", color: { argb: COLORS.border } },
    right: { style: "thin", color: { argb: COLORS.border } },
  };
}

function applyRowBorder(row: ExcelJS.Row, colCount: number) {
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.border = {
      top: { style: "hair", color: { argb: COLORS.border } },
      bottom: { style: "hair", color: { argb: COLORS.border } },
      left: { style: "thin", color: { argb: COLORS.border } },
      right: { style: "thin", color: { argb: COLORS.border } },
    };
  }
}

// ─────────────────────────────────────────────
// COLUMN DEFINITIONS
// ─────────────────────────────────────────────

const COLUMNS: {
  header: string;
  key: keyof ComparisonExcelRow | string;
  width: number;
  numFmt?: string;
  section: "id" | "price" | "tech" | "cond" | "rank";
}[] = [
  // — Identification —
  { header: "Produit", key: "product", width: 36, section: "id" },
  { header: "Lot", key: "lot", width: 18, section: "id" },
  { header: "Qté", key: "quantity", width: 8, numFmt: "#,##0", section: "id" },
  { header: "Unité", key: "unit", width: 10, section: "id" },
  { header: "Fournisseur", key: "supplierName", width: 26, section: "id" },

  // — Prix —
  {
    header: "Prix U HT",
    key: "unitPriceHT",
    width: 16,
    numFmt: '#,##0.00" DA"',
    section: "price",
  },
  { header: "TVA %", key: "tvaRate", width: 9, numFmt: "0%", section: "price" },
  {
    header: "Total HT",
    key: "totalHT",
    width: 16,
    numFmt: '#,##0.00" DA"',
    section: "price",
  },
  {
    header: "Total TTC",
    key: "totalTTC",
    width: 16,
    numFmt: '#,##0.00" DA"',
    section: "price",
  },

  // — Technique —
  {
    header: "Conformité %",
    key: "conformityPercentage",
    width: 13,
    numFmt: "0.0%",
    section: "tech",
  },
  {
    header: "Fiche technique",
    key: "technicalSheetStatus",
    width: 16,
    section: "tech",
  },

  // — Conditions —
  {
    header: "Délai livraison",
    key: "deliveryDelayText",
    width: 18,
    section: "cond",
  },
  { header: "Garantie", key: "warrantyText", width: 16, section: "cond" },
  { header: "SAV", key: "afterSalesService", width: 24, section: "cond" },
  {
    header: "Conditions paiem.",
    key: "paymentTerms",
    width: 20,
    section: "cond",
  },
  {
    header: "Validité (j)",
    key: "validityDays",
    width: 12,
    numFmt: "#,##0",
    section: "cond",
  },
  {
    header: "Échéance",
    key: "echeance",
    width: 16,
    numFmt: "DD/MM/YYYY",
    section: "cond",
  },

  // — Classement —
  {
    header: "Moins disant",
    key: "isLeastExpensive",
    width: 14,
    section: "rank",
  },
  { header: "Mieux disant", key: "isBestValue", width: 14, section: "rank" },
];

const SECTION_COLORS: Record<(typeof COLUMNS)[number]["section"], string> = {
  id: "2E4057",
  price: "1A5E8A",
  tech: "1A7A47",
  cond: "7A5C00",
  rank: "5C2D91",
};

// ─────────────────────────────────────────────
// MAIN GENERATOR
// ─────────────────────────────────────────────

export async function generateComparisonExcel(
  options: ComparisonExcelOptions,
): Promise<string> {
  const { offerId, title, rows, offerMeta } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Système d'analyse fournisseurs";
  workbook.lastModifiedBy = "Pipeline automatique";
  workbook.created = new Date();

  await buildComparisonSheet(workbook, title, rows, offerMeta);
  await buildSummarySheet(workbook, rows);

  const folder = path.join("uploads", "exports", offerId);
  await fs.mkdir(folder, { recursive: true });

  const fileName = `comparaison-globale-${offerId}.xlsx`;
  const filePath = path.join(folder, fileName);

  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

// ─────────────────────────────────────────────
// FEUILLE 1 : COMPARAISON GLOBALE
// ─────────────────────────────────────────────

async function buildComparisonSheet(
  workbook: ExcelJS.Workbook,
  title: string,
  rows: ComparisonExcelRow[],
  offerMeta?: ComparisonExcelOptions["offerMeta"],
) {
  const ws = workbook.addWorksheet("Comparaison globale", {
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      paperSize: 9, // A4
    },
    views: [{ state: "frozen", xSplit: 0, ySplit: 4 }],
  });

  // ── Row 1: Title ──────────────────────────────────────────────────────────
  ws.mergeCells(1, 1, 1, COLUMNS.length);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = {
    bold: true,
    size: 13,
    color: { argb: "FFFFFF" },
    name: "Arial",
  };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.headerBg },
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;

  // ── Row 2: Offer meta ─────────────────────────────────────────────────────
  const metaText = [
    offerMeta?.consultationNumber
      ? `Consultation: ${offerMeta.consultationNumber}`
      : null,
    offerMeta?.establishment
      ? `Établissement: ${offerMeta.establishment}`
      : null,
    offerMeta?.lotNumber ? `Lot ${offerMeta.lotNumber}` : null,
    offerMeta?.technicalDepartmentDepositDate
      ? `Remise service technique: ${formatDate(offerMeta.technicalDepartmentDepositDate)}`
      : null,
  ]
    .filter(Boolean)
    .join("   |   ");

  ws.mergeCells(2, 1, 2, COLUMNS.length);
  const metaCell = ws.getCell(2, 1);
  metaCell.value = metaText || "Tableau de comparaison des offres fournisseurs";
  metaCell.font = {
    italic: true,
    size: 9,
    color: { argb: COLORS.muted },
    name: "Arial",
  };
  metaCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "F0F4F8" },
  };
  metaCell.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(2).height = 18;

  // ── Row 3: Section headers ────────────────────────────────────────────────
  const sectionSpans: Record<
    string,
    { start: number; end: number; label: string }
  > = {
    id: { start: 1, end: 5, label: "Identification" },
    price: { start: 6, end: 9, label: "Prix" },
    tech: { start: 10, end: 11, label: "Analyse technique" },
    cond: { start: 12, end: 18, label: "Conditions commerciales" },
    rank: { start: 19, end: COLUMNS.length, label: "Classement" },
  };

  for (const [section, span] of Object.entries(sectionSpans)) {
    if (span.start === span.end) {
      ws.getCell(3, span.start).value = span.label;
    } else {
      ws.mergeCells(3, span.start, 3, span.end);
      ws.getCell(3, span.start).value = span.label;
    }
    const cell = ws.getCell(3, span.start);
    cell.font = {
      bold: true,
      size: 9,
      color: { argb: "FFFFFF" },
      name: "Arial",
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: SECTION_COLORS[section as keyof typeof SECTION_COLORS] },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }
  ws.getRow(3).height = 20;

  // ── Row 4: Column headers ─────────────────────────────────────────────────
  ws.columns = COLUMNS.map((col) => ({
    key: col.key,
    width: col.width,
  }));

  COLUMNS.forEach((col, i) => {
    const cell = ws.getCell(4, i + 1);
    cell.value = col.header;
    headerStyle(ws, cell, SECTION_COLORS[col.section], "FFFFFF");
  });
  ws.getRow(4).height = 32;

  // ── Data rows ─────────────────────────────────────────────────────────────
  rows.forEach((row, idx) => {
    const excelRowNum = idx + 5;
    const excelRow = ws.addRow(buildRowValues(row));

    excelRow.height = 18;
    excelRow.font = { size: 9, name: "Arial" };

    // Zebra striping
    if (idx % 2 === 1) {
      for (let c = 1; c <= COLUMNS.length; c++) {
        const cell = excelRow.getCell(c);
        if (
          !cell.fill ||
          (cell.fill as ExcelJS.FillPattern).fgColor?.argb === undefined
        ) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: COLORS.rowAlt },
          };
        }
      }
    }

    applyRowBorder(excelRow, COLUMNS.length);

    // — Conditional formatting per cell —

    // Conformity %
    const confCell = excelRow.getCell(10);
    if (row.conformityPercentage !== null) {
      confCell.value = row.conformityPercentage / 100; // stored as 0-100, display as %
      confCell.numFmt = "0.0%";
      if (row.conformityPercentage < 70) {
        confCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.red },
        };
        confCell.font = {
          color: { argb: COLORS.redText },
          bold: true,
          size: 9,
          name: "Arial",
        };
      } else if (row.conformityPercentage >= 90) {
        confCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.green },
        };
        confCell.font = {
          color: { argb: COLORS.greenText },
          bold: true,
          size: 9,
          name: "Arial",
        };
      }
    } else {
      confCell.value = "N/A";
      confCell.font = {
        color: { argb: COLORS.muted },
        italic: true,
        size: 9,
        name: "Arial",
      };
    }

    // Fiche technique
    const ficheCell = excelRow.getCell(11);
    if (row.technicalSheetStatus === "non_existe") {
      ficheCell.value = "✗ Non existe";
      ficheCell.font = {
        color: { argb: COLORS.redText },
        italic: true,
        size: 9,
        name: "Arial",
      };
    } else {
      ficheCell.value = "✓ Existe";
      ficheCell.font = {
        color: { argb: COLORS.greenText },
        size: 9,
        name: "Arial",
      };
    }

    // Moins disant
    const moinsCell = excelRow.getCell(COLUMNS.length - 1);
    if (row.isLeastExpensive) {
      moinsCell.value = "✓ OUI";
      moinsCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.green },
      };
      moinsCell.font = {
        bold: true,
        color: { argb: COLORS.greenText },
        size: 9,
        name: "Arial",
      };
      moinsCell.alignment = { horizontal: "center", vertical: "middle" };
    } else {
      moinsCell.value = "";
    }

    // Mieux disant
    const mieuxCell = excelRow.getCell(COLUMNS.length);
    if (row.isBestValue) {
      mieuxCell.value = "✓ OUI";
      mieuxCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.amber },
      };
      mieuxCell.font = {
        bold: true,
        color: { argb: COLORS.amberText },
        size: 9,
        name: "Arial",
      };
      mieuxCell.alignment = { horizontal: "center", vertical: "middle" };
    } else {
      mieuxCell.value = "";
    }

    // Number formatting on price columns
    [6, 8, 9].forEach((colIdx) => {
      excelRow.getCell(colIdx).numFmt = '#,##0.00" DA"';
      excelRow.getCell(colIdx).alignment = { horizontal: "right" };
    });

    // TVA as percentage
    excelRow.getCell(7).numFmt = "0%";
    excelRow.getCell(7).alignment = { horizontal: "center" };

    // Qty
    excelRow.getCell(3).alignment = { horizontal: "center" };

    // Écheance date format
    if (row.echeance) {
      excelRow.getCell(17).numFmt = "DD/MM/YYYY";
    }
  });

  // ── Auto-filter on header row ─────────────────────────────────────────────
  ws.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4 + rows.length, column: COLUMNS.length },
  };

  // ── Totals row ────────────────────────────────────────────────────────────
  if (rows.length > 0) {
    const totalRowNum = 5 + rows.length;
    const totalRow = ws.getRow(totalRowNum);
    totalRow.height = 20;

    ws.mergeCells(totalRowNum, 1, totalRowNum, 5);
    const labelCell = totalRow.getCell(1);
    labelCell.value = "TOTAL (somme des produits sélectionnés)";
    labelCell.font = {
      bold: true,
      size: 9,
      name: "Arial",
      color: { argb: COLORS.headerBg },
    };
    labelCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "E8EFF8" },
    };

    // Total HT formula
    const totalHTCell = totalRow.getCell(8);
    totalHTCell.value = { formula: `SUM(H5:H${totalRowNum - 1})` };
    totalHTCell.numFmt = '#,##0.00" DA"';
    totalHTCell.font = { bold: true, size: 9, name: "Arial" };
    totalHTCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "E8EFF8" },
    };

    // Total TTC formula
    const totalTTCCell = totalRow.getCell(9);
    totalTTCCell.value = { formula: `SUM(I5:I${totalRowNum - 1})` };
    totalTTCCell.numFmt = '#,##0.00" DA"';
    totalTTCCell.font = { bold: true, size: 9, name: "Arial" };
    totalTTCCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "E8EFF8" },
    };

    applyRowBorder(totalRow, COLUMNS.length);
  }
}

// ─────────────────────────────────────────────
// FEUILLE 2 : SYNTHÈSE
// ─────────────────────────────────────────────

async function buildSummarySheet(
  workbook: ExcelJS.Workbook,
  rows: ComparisonExcelRow[],
) {
  const ws = workbook.addWorksheet("Synthèse fournisseurs");

  ws.mergeCells("A1:F1");
  const title = ws.getCell("A1");
  title.value = "Synthèse par fournisseur";
  title.font = {
    bold: true,
    size: 12,
    name: "Arial",
    color: { argb: "FFFFFF" },
  };
  title.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.headerBg },
  };
  title.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 26;

  const headers = [
    "Fournisseur",
    "Nb produits",
    "Total HT (DA)",
    "Conformité moy. %",
    "Fiches techniques",
    "Moins disant",
    "Mieux disant",
    "Délai livraison",
    "SAV",
  ];

  const headerRow = ws.addRow(headers);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    headerStyle(ws, cell, COLORS.subHeaderBg);
  });

  ws.columns = [
    { width: 28 },
    { width: 12 },
    { width: 16 },
    { width: 18 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 18 },
    { width: 24 },
  ];

  // Aggregate by supplier
  const bySupplier = new Map<
    string,
    {
      count: number;
      totalHT: number;
      conformitySum: number;
      conformityCount: number;
      fichesOk: number;
      isLeast: boolean;
      isBest: boolean;
      deliveryText: string | null;
      sav: string | null;
    }
  >();

  for (const row of rows) {
    const existing = bySupplier.get(row.supplierName) ?? {
      count: 0,
      totalHT: 0,
      conformitySum: 0,
      conformityCount: 0,
      fichesOk: 0,
      isLeast: false,
      isBest: false,
      deliveryText: null,
      sav: null,
    };

    existing.count++;
    existing.totalHT += row.totalHT;
    if (row.conformityPercentage !== null) {
      existing.conformitySum += row.conformityPercentage;
      existing.conformityCount++;
    }
    if (row.technicalSheetStatus === "existe") existing.fichesOk++;
    if (row.isLeastExpensive) existing.isLeast = true;
    if (row.isBestValue) existing.isBest = true;
    if (row.deliveryDelayText && !existing.deliveryText)
      existing.deliveryText = row.deliveryDelayText;
    if (row.afterSalesService && !existing.sav)
      existing.sav = row.afterSalesService;

    bySupplier.set(row.supplierName, existing);
  }

  let dataRowIdx = 3;
  for (const [name, agg] of bySupplier) {
    const avgConformity =
      agg.conformityCount > 0
        ? agg.conformitySum / agg.conformityCount / 100
        : null;

    const dataRow = ws.addRow([
      name,
      agg.count,
      agg.totalHT,
      avgConformity,
      `${agg.fichesOk}/${agg.count}`,
      agg.isLeast ? "✓ OUI" : "",
      agg.isBest ? "✓ OUI" : "",
      agg.deliveryText ?? "N/A",
      agg.sav ?? "N/A",
    ]);

    dataRow.height = 18;
    dataRow.font = { size: 9, name: "Arial" };
    dataRow.getCell(3).numFmt = '#,##0.00" DA"';
    dataRow.getCell(4).numFmt = "0.0%";

    if (agg.isLeast) {
      dataRow.getCell(6).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.green },
      };
      dataRow.getCell(6).font = {
        bold: true,
        color: { argb: COLORS.greenText },
        size: 9,
        name: "Arial",
      };
    }
    if (agg.isBest) {
      dataRow.getCell(7).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.amber },
      };
      dataRow.getCell(7).font = {
        bold: true,
        color: { argb: COLORS.amberText },
        size: 9,
        name: "Arial",
      };
    }

    applyRowBorder(dataRow, 9);
    dataRowIdx++;
  }
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function buildRowValues(row: ComparisonExcelRow): Record<string, unknown> {
  return {
    product: row.product,
    lot: row.lot,
    quantity: row.quantity,
    unit: row.unit ?? "U",
    supplierName: row.supplierName,
    unitPriceHT: row.unitPriceHT,
    tvaRate: row.tvaRate / 100, // stored as 19, display as 19%
    totalHT: row.totalHT,
    totalTTC: row.totalTTC,
    // conformityPercentage handled separately with conditional formatting
    // technicalSheetStatus handled separately
    deliveryDelayText:
      (row.deliveryDelayText ?? row.deliveryDelayDays)
        ? `${row.deliveryDelayDays} j`
        : "N/A",
    warrantyText:
      row.warrantyText ??
      (row.warrantyMonths ? `${row.warrantyMonths} mois` : "N/A"),
    afterSalesService: row.afterSalesService ?? "N/A",
    paymentTerms: row.paymentTerms ?? "N/A",
    validityDays: row.validityDays,
    echeance: row.echeance ?? null,
  };
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("fr-DZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
