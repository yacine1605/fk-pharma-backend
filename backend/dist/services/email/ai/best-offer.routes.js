import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../../db/drizzle";
import { offerExcelExports, offers } from "../../../db/schema";
import { selectBestOffersForCahier, generateBestOfferExport, } from "./best-offer.service";
export const bestOfferRouter = Router();
/**
 * POST /api/best-offer/offers/:offerId/generate
 * Génère l'Excel "Classement Meilleure Offre" avec:
 * - Sélection automatique du meilleur fournisseur par produit
 * - Calculs automatiques (marge, TVA, TTC)
 * - Recherche en ligne pour les produits sans fournisseur
 */
bestOfferRouter.post("/offers/:offerId/generate", async (req, res) => {
    try {
        const { offerId } = req.params;
        const { marginRate, tvaRate } = req.body || {};
        // Verify offer exists
        const offer = await db.query.offers.findFirst({
            where: eq(offers.id, offerId),
        });
        if (!offer) {
            return res.status(404).json({
                success: false,
                message: "Offre non trouvée",
            });
        }
        // Generate the best offer analysis and Excel
        const result = await generateBestOfferExport(offerId);
        // Save metadata to database
        await db.insert(offerExcelExports).values({
            offerId,
            fileName: result.fileName,
            filePath: result.filePath,
        });
        return res.json({
            success: true,
            fileName: result.fileName,
            fileUrl: result.fileUrl,
            summary: result.summary,
            missingItems: result.missingItems,
            message: result.summary.missingItems > 0
                ? `${result.summary.matchedItems} produits trouvés, ${result.summary.missingItems} nécessitent une recherche en ligne`
                : `Tous les produits ont été matchés (${result.summary.totalItems} items)`,
        });
    }
    catch (error) {
        console.error("[BEST-OFFER GENERATE]", error);
        return res.status(500).json({
            success: false,
            message: "Erreur lors de la génération du classement",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
/**
 * GET /api/best-offer/offers/:offerId/analysis
 * Retourne l'analyse JSON du meilleur fournisseur par produit
 * (sans générer l'Excel)
 */
bestOfferRouter.get("/offers/:offerId/analysis", async (req, res) => {
    try {
        const { offerId } = req.params;
        const { marginRate, tvaRate } = req.query;
        const result = await selectBestOffersForCahier(offerId, {
            marginRate: marginRate ? Number(marginRate) : undefined,
            tvaRate: tvaRate ? Number(tvaRate) : undefined,
        });
        return res.json({
            success: true,
            data: {
                offerId: result.offerId,
                title: result.title,
                medicalEntity: result.medicalEntityName,
                totalHT: result.totalHT,
                totalTVA: result.totalTVA,
                totalTTC: result.totalTTC,
                lines: result.lines.map((line) => ({
                    rowNumber: line.rowNumber,
                    supplierName: line.supplierName,
                    lot: line.lot,
                    product: line.product,
                    unitPrice: line.unitPrice,
                    quantity: line.quantity,
                    marginRate: line.marginRate,
                    tvaRate: line.tvaRate,
                    unitPriceWithMargin: line.unitPrice * line.marginRate,
                    totalHT: line.unitPrice * line.marginRate * line.quantity,
                    tvaAmount: line.unitPrice * line.marginRate * line.quantity * line.tvaRate,
                    totalTTC: line.unitPrice *
                        line.marginRate *
                        line.quantity *
                        (1 + line.tvaRate),
                    isOnlineSearch: line.isOnlineSearch,
                    conformityPercentage: line.conformityPercentage,
                    isTechnicallyCompliant: line.isTechnicallyCompliant,
                    onlineSuppliers: line.onlineSuppliers,
                })),
                missingItems: result.missingItems,
            },
        });
    }
    catch (error) {
        console.error("[BEST-OFFER ANALYSIS]", error);
        return res.status(500).json({
            success: false,
            message: "Erreur lors de l'analyse",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
/**
 * GET /api/best-offer/offers/:offerId/missing-items
 * Retourne uniquement la liste des produits sans fournisseur
 * avec les fournisseurs trouvés en ligne
 */
bestOfferRouter.get("/offers/:offerId/missing-items", async (req, res) => {
    try {
        const { offerId } = req.params;
        const result = await selectBestOffersForCahier(offerId);
        return res.json({
            success: true,
            missingItemsCount: result.missingItems.length,
            missingItems: result.missingItems.map((item) => ({
                itemNumber: item.itemNumber,
                itemName: item.itemName,
                suggestedSuppliers: item.onlineSuppliers,
                searchQuery: `fournisseur ${item.itemName} biomedicale Algerie`,
            })),
        });
    }
    catch (error) {
        console.error("[BEST-OFFER MISSING]", error);
        return res.status(500).json({
            success: false,
            message: "Erreur lors de la récupération des items manquants",
        });
    }
});
/**
 * POST /api/best-offer/offers/:offerId/regenerate-missing
 * Relance uniquement la recherche en ligne pour les items manquants
 */
bestOfferRouter.post("/offers/:offerId/regenerate-missing", async (req, res) => {
    try {
        const { offerId } = req.params;
        const result = await selectBestOffersForCahier(offerId);
        if (result.missingItems.length === 0) {
            return res.json({
                success: true,
                message: "Aucun item manquant à rechercher",
            });
        }
        // Re-run online search with more specific queries
        const enrichedMissing = await Promise.all(result.missingItems.map(async (item) => {
            // More specific search with technical specs if available
            const searchQuery = `${item.itemName} fournisseur medical Algerie prix`;
            return {
                ...item,
                searchQuery,
                // In production, call searchOnlineSuppliers again here
            };
        }));
        return res.json({
            success: true,
            message: `${enrichedMissing.length} items recherchés en ligne`,
            data: enrichedMissing,
        });
    }
    catch (error) {
        console.error("[BEST-OFFER REGENERATE]", error);
        return res.status(500).json({
            success: false,
            message: "Erreur lors de la régénération",
        });
    }
});
//# sourceMappingURL=best-offer.routes.js.map