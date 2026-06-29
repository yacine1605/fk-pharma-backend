import { Request, Response } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

async function generateComparisonExcel(payload: any): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Comparaison");

  worksheet.columns = [
    { header: "Fournisseur", key: "name", width: 25 },
    { header: "Produit", key: "product", width: 35 },
    { header: "Quantité", key: "quantity", width: 12 },
    { header: "Prix Unitaire HT", key: "unitPrice", width: 15 },
    { header: "Total HT", key: "totalHT", width: 15 },
    { header: "Conformité %", key: "conformity", width: 15 },
  ];

  if (payload.suppliers && Array.isArray(payload.suppliers)) {
    payload.suppliers.forEach((s: any) => {
      if (s.matches && Array.isArray(s.matches)) {
        s.matches.forEach((m: any) => {
          worksheet.addRow({
            name: s.supplierName || "",
            product: m.supplierItem?.designation || m.referenceItem?.designation || "",
            quantity: m.supplierItem?.quantity || m.referenceItem?.quantity || 0,
            unitPrice: m.supplierItem?.unitPrice || 0,
            totalHT: m.supplierItem?.totalPrice || 0,
            conformity: m.compatibility || 0,
          });
        });
      }
    });
  }

  return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
}

async function generateComparisonPDF(payload: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const buffers: Buffer[] = [];
    doc.on("data", (chunk: any) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", (err: any) => reject(err));

    doc.fontSize(20).text("Rapport de Comparaison des Offres", 100, 50);
    doc.fontSize(10).text(`Généré le: ${payload.generatedAt || new Date().toLocaleDateString()}`, 100, 80);
    doc.text(`Titre de l'offre: ${payload.offerTitle || "N/A"}`, 100, 95);
    doc.moveDown();

    if (payload.suppliers && Array.isArray(payload.suppliers)) {
      payload.suppliers.forEach((s: any) => {
        doc.fontSize(12).text(`Fournisseur: ${s.supplierName || "Nom inconnu"}`, { underline: true });
        doc.moveDown(0.5);
        if (s.matches && Array.isArray(s.matches)) {
          s.matches.forEach((m: any) => {
            const refName = m.referenceItem?.designation || "Inconnu";
            const supName = m.supplierItem?.designation || "Non proposé";
            const price = m.supplierItem?.unitPrice ? `${m.supplierItem.unitPrice} DZD` : "N/A";
            const comp = m.compatibility != null ? `${m.compatibility}%` : "0%";
            doc.fontSize(10).text(`  - Ref: ${refName}`);
            doc.text(`    Proposé: ${supName} | Prix: ${price} | Conformité: ${comp}`);
            doc.moveDown(0.2);
          });
        }
        doc.moveDown();
      });
    }

    doc.end();
  });
}

/**
 * POST /api/exports/comparison-excel
 * Body: { offerTitle, generatedAt, suppliers }
 */
export async function exportExcel(req: Request, res: Response): Promise<void> {
  try {
    const payload = req.body;

    if (!payload.suppliers || !Array.isArray(payload.suppliers)) {
      res.status(400).json({ error: "Payload invalide: suppliers manquant" });
      return;
    }

    console.log(
      "[Export] Génération Excel pour",
      payload.suppliers.length,
      "fournisseurs",
    );

    const buffer = await generateComparisonExcel(payload);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="comparaison-fournisseurs.xlsx"',
    );
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (error) {
    console.error("[Export] Erreur Excel:", error);
    res.status(500).json({ error: "Erreur pendant l'export Excel" });
  }
}

/**
 * POST /api/exports/comparison-pdf
 * Body: { offerTitle, generatedAt, suppliers }
 */
export async function exportPDF(req: Request, res: Response): Promise<void> {
  try {
    const payload = req.body;

    if (!payload.suppliers || !Array.isArray(payload.suppliers)) {
      res.status(400).json({ error: "Payload invalide: suppliers manquant" });
      return;
    }

    console.log(
      "[Export] Génération PDF pour",
      payload.suppliers.length,
      "fournisseurs",
    );

    const buffer = await generateComparisonPDF(payload);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="comparaison-fournisseurs.pdf"',
    );
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (error) {
    console.error("[Export] Erreur PDF:", error);
    res.status(500).json({ error: "Erreur pendant l'export PDF" });
  }
}
