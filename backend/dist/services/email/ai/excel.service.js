import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
export async function generatePricingExcel(params) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Digitservz";
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet("Classement");
    worksheet.columns = [
        { key: "number", width: 6 },
        { key: "supplier", width: 22 },
        { key: "lot", width: 16 },
        { key: "product", width: 42 },
        { key: "unitPrice", width: 15 },
        { key: "quantity", width: 14 },
        { key: "margin", width: 12 },
        { key: "unitPriceWithMargin", width: 18 },
        { key: "totalHT", width: 18 },
        { key: "tvaRate", width: 12 },
        { key: "tvaAmount", width: 18 },
        { key: "totalTTC", width: 18 },
    ];
    worksheet.getRow(1).height = 18;
    worksheet.getRow(2).height = 18;
    worksheet.getRow(3).height = 18;
    worksheet.mergeCells("D4:E4");
    worksheet.getCell("D4").value = params.title;
    worksheet.getCell("D4").alignment = {
        horizontal: "center",
        vertical: "middle",
    };
    worksheet.getCell("D4").font = {
        bold: true,
        size: 10,
    };
    worksheet.getCell("D4").fill = {
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
    worksheet.getCell("I4").value = "TOTAL HT";
    worksheet.getCell("I4").alignment = {
        horizontal: "center",
        vertical: "middle",
    };
    worksheet.getCell("I4").font = {
        bold: true,
        size: 9,
    };
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
    worksheet.getCell("K4").font = {
        bold: true,
        size: 9,
    };
    worksheet.getCell("K4").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "D9D2E9" },
    };
    const headerRowNumber = 5;
    worksheet.getRow(headerRowNumber).values = [
        "N°",
        "FOURNISSEUR",
        "LOT",
        "PRODUIT",
        "PRIX U",
        "Qte\nmin",
        "Marge",
        "Prix U / Marge",
        "TOT",
        "TVA",
        "TOT",
        "",
    ];
    worksheet.getRow(headerRowNumber).height = 28;
    for (let col = 1; col <= 12; col++) {
        const cell = worksheet.getCell(headerRowNumber, col);
        cell.font = {
            bold: true,
            size: 8,
        };
        cell.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
        };
        cell.border = borderStyle();
    }
    const startRow = 6;
    params.lines.forEach((line, index) => {
        const rowNumber = startRow + index;
        const row = worksheet.getRow(rowNumber);
        const unitPriceWithMargin = line.unitPrice * line.marginRate;
        const totalHT = unitPriceWithMargin * line.quantity;
        const tvaAmount = totalHT * line.tvaRate;
        const totalTTC = totalHT + tvaAmount;
        row.values = [
            index + 1,
            line.supplierName ?? "",
            line.lot ?? "",
            line.product,
            line.unitPrice,
            line.quantity,
            line.marginRate,
            {
                formula: `E${rowNumber}*G${rowNumber}`,
                result: unitPriceWithMargin,
            },
            {
                formula: `H${rowNumber}*F${rowNumber}`,
                result: totalHT,
            },
            line.tvaRate,
            {
                formula: `I${rowNumber}*J${rowNumber}`,
                result: tvaAmount,
            },
            {
                formula: `I${rowNumber}+K${rowNumber}`,
                result: totalTTC,
            },
        ];
        row.height = 22;
        for (let col = 1; col <= 12; col++) {
            const cell = worksheet.getCell(rowNumber, col);
            cell.border = borderStyle();
            cell.alignment = {
                vertical: "middle",
                horizontal: col === 4 ? "left" : "center",
                wrapText: true,
            };
            cell.font = {
                size: 9,
            };
        }
        worksheet.getCell(`E${rowNumber}`).numFmt = "#,##0.00";
        worksheet.getCell(`G${rowNumber}`).numFmt = "0%";
        worksheet.getCell(`H${rowNumber}`).numFmt = "#,##0.00";
        worksheet.getCell(`I${rowNumber}`).numFmt = "#,##0.00";
        worksheet.getCell(`J${rowNumber}`).numFmt = "0%";
        worksheet.getCell(`K${rowNumber}`).numFmt = "#,##0.00";
        worksheet.getCell(`L${rowNumber}`).numFmt = "#,##0.00";
    });
    const totalRowNumber = startRow + params.lines.length;
    worksheet.getCell(`H${totalRowNumber}`).value = "HT";
    worksheet.getCell(`I${totalRowNumber}`).value = {
        formula: `SUM(I${startRow}:I${totalRowNumber - 1})`,
    };
    worksheet.getCell(`J${totalRowNumber}`).value = "TVA";
    worksheet.getCell(`K${totalRowNumber}`).value = {
        formula: `SUM(K${startRow}:K${totalRowNumber - 1})`,
    };
    worksheet.getCell(`L${totalRowNumber}`).value = {
        formula: `SUM(L${startRow}:L${totalRowNumber - 1})`,
    };
    const ttcRowNumber = totalRowNumber + 1;
    worksheet.getCell(`H${ttcRowNumber}`).value = "TTC";
    worksheet.getCell(`I${ttcRowNumber}`).value = {
        formula: `SUM(L${startRow}:L${totalRowNumber - 1})`,
    };
    for (const rowNumber of [totalRowNumber, ttcRowNumber]) {
        for (let col = 8; col <= 12; col++) {
            const cell = worksheet.getCell(rowNumber, col);
            cell.border = borderStyle();
            cell.font = {
                bold: true,
                size: 9,
            };
            cell.alignment = {
                horizontal: "center",
                vertical: "middle",
            };
            cell.numFmt = "#,##0.00";
        }
    }
    worksheet.getCell(`K${totalRowNumber}`).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF2CC" },
    };
    worksheet.getCell(`L${totalRowNumber}`).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "F4CCCC" },
    };
    worksheet.getCell(`K${totalRowNumber}`).font = {
        bold: true,
        color: { argb: "C00000" },
    };
    worksheet.getCell(`L${totalRowNumber}`).font = {
        bold: true,
        color: { argb: "C00000" },
    };
    worksheet.views = [
        {
            state: "frozen",
            ySplit: 5,
        },
    ];
    const folder = path.join("uploads", "exports", params.offerId);
    await fs.mkdir(folder, { recursive: true });
    const fileName = `classement-prix-${params.offerId}.xlsx`;
    const filePath = path.join(folder, fileName);
    await workbook.xlsx.writeFile(filePath);
    return {
        fileName,
        filePath,
    };
}
function borderStyle() {
    return {
        top: { style: "thin", color: { argb: "000000" } },
        left: { style: "thin", color: { argb: "000000" } },
        bottom: { style: "thin", color: { argb: "000000" } },
        right: { style: "thin", color: { argb: "000000" } },
    };
}
//# sourceMappingURL=excel.service.js.map