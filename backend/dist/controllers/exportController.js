/**
 * POST /api/exports/comparison-excel
 * Body: { offerTitle, generatedAt, suppliers }
 */
export async function exportExcel(req, res) {
    try {
        const payload = req.body;
        if (!payload.suppliers || !Array.isArray(payload.suppliers)) {
            res.status(400).json({ error: "Payload invalide: suppliers manquant" });
            return;
        }
        console.log("[Export] Génération Excel pour", payload.suppliers.length, "fournisseurs");
        const buffer = await generateComparisonExcel(payload);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", 'attachment; filename="comparaison-fournisseurs.xlsx"');
        res.setHeader("Content-Length", buffer.length);
        res.send(buffer);
    }
    catch (error) {
        console.error("[Export] Erreur Excel:", error);
        res.status(500).json({ error: "Erreur pendant l'export Excel" });
    }
}
/**
 * POST /api/exports/comparison-pdf
 * Body: { offerTitle, generatedAt, suppliers }
 */
export async function exportPDF(req, res) {
    try {
        const payload = req.body;
        if (!payload.suppliers || !Array.isArray(payload.suppliers)) {
            res.status(400).json({ error: "Payload invalide: suppliers manquant" });
            return;
        }
        console.log("[Export] Génération PDF pour", payload.suppliers.length, "fournisseurs");
        const buffer = await generateComparisonPDF(payload);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", 'attachment; filename="comparaison-fournisseurs.pdf"');
        res.setHeader("Content-Length", buffer.length);
        res.send(buffer);
    }
    catch (error) {
        console.error("[Export] Erreur PDF:", error);
        res.status(500).json({ error: "Erreur pendant l'export PDF" });
    }
}
//# sourceMappingURL=exportController.js.map