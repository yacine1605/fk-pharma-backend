import { Router } from "express";
import { enqueuePendingSupplierResponsesPipeline, processOfferAnalysisPipeline, processSupplierResponsePipeline, recomputeOfferSupplierRanking, } from "./analysis.pipeline";
export const analysisPipelineRouter = Router();
analysisPipelineRouter.post("/pending/run", async (_req, res) => {
    try {
        ///const result = await runPendingSupplierResponsesPipeline();
        const result = await enqueuePendingSupplierResponsesPipeline();
        return res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        console.error("[PIPELINE PENDING RUN]", error);
        return res.status(500).json({
            success: false,
            message: "Erreur pendant l'exécution de la pipeline.",
        });
    }
});
analysisPipelineRouter.post("/offers/:offerId/run", async (req, res) => {
    try {
        const { offerId } = req.params;
        const result = await processOfferAnalysisPipeline(offerId);
        return res.json({
            success: true,
            offerId,
            data: result,
        });
    }
    catch (error) {
        console.error("[PIPELINE OFFER RUN]", error);
        return res.status(500).json({
            success: false,
            message: "Erreur pendant l'analyse de l'offre.",
        });
    }
});
analysisPipelineRouter.post("/responses/:supplierResponseId/run", async (req, res) => {
    try {
        const { supplierResponseId } = req.params;
        const result = await processSupplierResponsePipeline(supplierResponseId, {
            force: req.body?.force === true,
        });
        const response = await db.query.supplierResponses.findFirst({
            where: eq(supplierResponses.id, supplierResponseId),
        });
        let ranking = null;
        if (response) {
            ranking = await recomputeOfferSupplierRanking(response.offerId);
        }
        return res.json({
            success: true,
            data: result,
            ranking,
        });
    }
    catch (error) {
        console.error("[PIPELINE RESPONSE RUN]", error);
        return res.status(500).json({
            success: false,
            message: "Erreur pendant l'analyse de la réponse fournisseur.",
        });
    }
});
analysisPipelineRouter.post("/offers/:offerId/ranking", async (req, res) => {
    try {
        const { offerId } = req.params;
        const result = await recomputeOfferSupplierRanking(offerId);
        return res.json({
            success: true,
            offerId,
            data: result,
        });
    }
    catch (error) {
        console.error("[PIPELINE RANKING]", error);
        return res.status(500).json({
            success: false,
            message: "Erreur pendant le recalcul du classement.",
        });
    }
});
import { processOfferItemsFromAttachments } from "./offer-items-extraction.pipeline";
import { eq } from "drizzle-orm";
import { db } from "../../../db/drizzle";
import { supplierResponses } from "../../../db/schema";
import { buildAndExportComparisonExcel } from "./Comparison.service";
import path from "path";
analysisPipelineRouter.post("/offers/:offerId/export-comparison", async (req, res) => {
    try {
        const { offerId } = req.params;
        const { filePath, rowCount } = await buildAndExportComparisonExcel(offerId);
        // Build a relative download URL — adapt to your static-file serving setup
        const relativePath = path
            .relative(process.cwd(), filePath)
            .replace(/\\/g, "/");
        return res.json({
            success: true,
            offerId,
            rowCount,
            filePath,
            downloadUrl: `/${relativePath}`,
        });
    }
    catch (error) {
        console.error("[EXPORT COMPARISON]", error);
        return res.status(500).json({
            success: false,
            message: error instanceof Error
                ? error.message
                : "Erreur pendant la génération du tableau de comparaison.",
        });
    }
});
analysisPipelineRouter.post("/offers/:offerId/extract-items", async (req, res) => {
    try {
        const { offerId } = req.params;
        const overwrite = req.body?.overwrite === true;
        const result = await processOfferItemsFromAttachments(offerId, {
            overwrite,
        });
        return res.json(result);
    }
    catch (error) {
        console.error("[OFFER ITEMS EXTRACTION]", error);
        return res.status(500).json({
            success: false,
            message: "Erreur pendant l'extraction des articles de l'offre.",
        });
    }
});
analysisPipelineRouter.post("/offers/:offerId/full-run", async (req, res) => {
    try {
        const { offerId } = req.params;
        const overwriteOfferItems = req.body?.overwriteOfferItems === true;
        const offerItemsResult = await processOfferItemsFromAttachments(offerId, {
            overwrite: overwriteOfferItems,
        });
        if (!offerItemsResult.success) {
            return res.status(400).json({
                success: false,
                step: "offer_items_extraction",
                message: offerItemsResult.message,
                data: offerItemsResult,
            });
        }
        const analysisResults = await processOfferAnalysisPipeline(offerId);
        const ranking = await recomputeOfferSupplierRanking(offerId);
        return res.json({
            success: true,
            offerId,
            offerItemsExtraction: offerItemsResult,
            supplierAnalysis: analysisResults,
            ranking,
        });
    }
    catch (error) {
        console.error("[FULL OFFER ANALYSIS]", error);
        return res.status(500).json({
            success: false,
            message: "Erreur pendant l'analyse complète de l'offre.",
        });
    }
});
//# sourceMappingURL=analysis.pipeline.routes.js.map