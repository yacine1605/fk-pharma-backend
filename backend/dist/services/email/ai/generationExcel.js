import ExcelJS from "exceljs";
import path from "path";
import fs from "fs/promises";
export async function generateRankingExcel(lotId, offers) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Classement fournisseurs");
    worksheet.columns = [
        { header: "Rang", key: "rank", width: 10 },
        { header: "Fournisseur", key: "supplierName", width: 30 },
        { header: "Prix HT", key: "priceHT", width: 15 },
        { header: "TVA", key: "tva", width: 10 },
        { header: "Prix TTC", key: "priceTTC", width: 15 },
        { header: "Conformité %", key: "conformityPercentage", width: 18 },
        { header: "Score conditions", key: "conditionsScore", width: 18 },
        { header: "Score global", key: "globalScore", width: 15 },
        { header: "Facture pro-forma", key: "proformaUrl", width: 40 },
        { header: "Fiche technique", key: "technicalSheetUrl", width: 40 },
    ];
    offers.forEach((offer) => {
        worksheet.addRow({
            rank: offer.rank,
            supplierName: offer.supplierName,
            priceHT: offer.priceHT,
            tva: offer.tva,
            priceTTC: offer.priceTTC,
            conformityPercentage: offer.conformityPercentage,
            conditionsScore: offer.conditionsScore,
            globalScore: offer.globalScore,
            proformaUrl: offer.proformaUrl,
            technicalSheetUrl: offer.technicalSheetUrl,
        });
    });
    worksheet.getRow(1).font = {
        bold: true,
    };
    for (let i = 2; i <= offers.length + 1; i++) {
        const proformaCell = worksheet.getCell(`I${i}`);
        const technicalCell = worksheet.getCell(`J${i}`);
        if (proformaCell.value) {
            proformaCell.value = {
                text: "Voir pro-forma",
                hyperlink: String(proformaCell.value),
            };
            proformaCell.font = {
                color: { argb: "0000FF" },
                underline: true,
            };
        }
        if (technicalCell.value) {
            technicalCell.value = {
                text: "Voir fiche technique",
                hyperlink: String(technicalCell.value),
            };
            technicalCell.font = {
                color: { argb: "0000FF" },
                underline: true,
            };
        }
    }
    const folder = path.join("uploads", "exports", lotId);
    await fs.mkdir(folder, { recursive: true });
    const filePath = path.join(folder, `classement-${lotId}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
}
//# sourceMappingURL=generationExcel.js.map