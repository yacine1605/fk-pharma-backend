import express, { Router } from "express";
import path from "path";
import fs from "fs/promises";
import { eq } from "drizzle-orm";

import { db } from "../../../db/drizzle";
import { offers } from "../../../db/schema";

import { generateBestOfferExport } from "./best-offer.service";

const router: Router = express.Router();

// ─────────────────────────────────────────────
// GET /api/excel/offers/:offerId/proforma-summary
// Résumé des proformas pour un offre (dashboard)
// ─────────────────────────────────────────────
router.get("/offers/:offerId/proforma-summary", async (req, res) => {
  try {
    const { offerId } = req.params;

    const offer = await db.query.offers.findFirst({
      where: eq(offers.id, offerId),
      with: {
        offerSuppliers: {
          with: {
            supplier: true,
            supplierResponse: {
              with: {
                proforma: true,
              },
            },
          },
        },
        offerItems: true,
      },
    });

    if (!offer) {
      return res.status(404).json({ error: "Offer not found" });
    }

    const totalSuppliers = offer.offerSuppliers.length;
    const totalItems = offer.offerItems.length;

    const proformasReceived = offer.offerSuppliers.filter((os) => {
      return (
        os.supplierResponse?.status === "analyzed" ||
        os.supplierResponse?.status === "needs_review"
      );
    }).length;

    const proformasPending = totalSuppliers - proformasReceived;

    const suppliersWithDetails = offer.offerSuppliers.map((os) => {
      const response = os.supplierResponse;
      const proforma = response?.proforma;

      return {
        supplierId: os.supplierId,
        supplierName: os.supplier.name,
        status: response?.status ?? "pending",
        quotationReceived: response?.quotationReceived ?? false,
        respondedAt: response?.respondedAt ?? null,
        analyzedAt: response?.analyzedAt ?? null,
        proformaNumber: proforma?.proformaNumber ?? null,
        totalHT: proforma?.totalHT ?? null,
        totalTTC: proforma?.totalTTC ?? null,
        currency: proforma?.currency ?? "DZD",
        validityDays: proforma?.validityDays ?? null,
      };
    });

    return res.json({
      offerId: offer.id,
      title: offer.title,
      totalSuppliers,
      totalItems,
      proformasReceived,
      proformasPending,
      suppliers: suppliersWithDetails,
    });
  } catch (error) {
    console.error("[PROFORMA SUMMARY ERROR]", error);
    return res.status(500).json({ error: "Failed to generate summary" });
  }
});

// ─────────────────────────────────────────────
// POST /api/excel/offers/:offerId/export-best-offer
// Génère l'Excel du meilleur offre (classement)
// ─────────────────────────────────────────────
router.post("/offers/:offerId/export-best-offer", async (req, res) => {
  try {
    const { offerId } = req.params;
    const { marginRate, tvaRate } = req.body;

    const result = await generateBestOfferExport(offerId);

    return res.json({
      success: true,
      fileUrl: result.fileUrl,
      fileName: result.fileName,
      summary: result.summary,
      missingItems: result.missingItems,
    });
  } catch (error) {
    console.error("[EXPORT BEST OFFER ERROR]", error);
    return res.status(500).json({
      error: "Failed to generate best offer export",
      details: (error as Error).message,
    });
  }
});

// ─────────────────────────────────────────────
// GET /api/excel/download/:offerId/:fileName
// Téléchargement sécurisé des fichiers Excel
// ─────────────────────────────────────────────
router.get("/download/:offerId/:fileName", async (req, res) => {
  try {
    const { offerId, fileName } = req.params;

    // ← CORRIGÉ: Validation du nom de fichier pour éviter path traversal
    const sanitizedFileName = path.basename(fileName);
    if (sanitizedFileName !== fileName) {
      return res.status(400).json({ error: "Invalid file name" });
    }

    const filePath = path.resolve(
      "uploads",
      "exports",
      offerId,
      sanitizedFileName,
    );

    // ← CORRIGÉ: Vérification que le fichier est bien dans le dossier attendu
    const expectedBase = path.resolve("uploads", "exports", offerId);
    if (!filePath.startsWith(expectedBase)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: "File not found" });
    }

    return res.download(filePath, sanitizedFileName, (err) => {
      if (err) {
        console.error("[DOWNLOAD ERROR]", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Download failed" });
        }
      }
    });
  } catch (error) {
    console.error("[DOWNLOAD ROUTE ERROR]", error);
    return res.status(500).json({ error: "Download failed" });
  }
});

export default router;
