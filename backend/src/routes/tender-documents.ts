import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { eq } from "drizzle-orm";

import { db } from "../db/drizzle";
import {
  tenderDocuments,
  offers,
  offerItems,
  type TenderDocument,
} from "../db/schema";
import { tenderExtractionQueue } from "../services/email/ai/queues";
import { processTenderDocument } from "../services/tender/tender-extraction.service";
import { AuthRequest, requireRole } from "../middleware/auth";

const router = Router();

// ─── Multer Config ────────────────────────────────────────────────────────────

const tenderUploadsDir = process.env.TENDER_UPLOADS_DIR ?? "uploads/tender-docs";

if (!fs.existsSync(tenderUploadsDir)) {
  fs.mkdirSync(tenderUploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, tenderUploadsDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._\-]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/tiff",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Format non supporté: ${file.mimetype}`));
    }
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ok = <T>(data: T) => ({ success: true as const, data });
const fail = (message: string, status = 400) => ({ success: false as const, error: message, status });

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/tender-documents/:offerId/upload
 * Téléverse un fichier cahier des charges et lance l'extraction asynchrone.
 */
router.post(
  "/:offerId/upload",
  requireRole(["admin", "agent_commercial", "technique"]),
  upload.single("file"),
  async (req: AuthRequest, res) => {
    try {
      const { offerId } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ success: false, error: "Aucun fichier fourni." });
      }

      // Verify offer exists
      const offer = await db.query.offers.findFirst({
        where: eq(offers.id, offerId),
      });

      if (!offer) {
        fs.unlinkSync(file.path);
        return res.status(404).json({ success: false, error: "Offre introuvable." });
      }

      // Insert document record
      const [doc] = await db
        .insert(tenderDocuments)
        .values({
          offerId,
          fileName: file.originalname,
          filePath: file.path,
          mimeType: file.mimetype,
          fileSize: file.size,
          status: "uploaded",
          uploadedBy: req.userId ?? null,
        })
        .returning();

      // Enqueue async extraction
      await tenderExtractionQueue.add(
        "extract-tender",
        { documentId: doc.id },
        {
          jobId: `tender-${doc.id}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 15_000 },
          removeOnComplete: 200,
          removeOnFail: 200,
        },
      );

      return res.status(201).json(
        ok({
          documentId: doc.id,
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          status: doc.status,
          message: "Fichier téléversé. Extraction en cours...",
        }),
      );
    } catch (error) {
      console.error("[TENDER-UPLOAD]", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Erreur serveur",
      });
    }
  },
);

/**
 * GET /api/tender-documents/:offerId
 * Liste tous les documents cahier des charges d'une offre.
 */
router.get("/:offerId", async (req, res) => {
  try {
    const { offerId } = req.params;

    const docs = await db.query.tenderDocuments.findMany({
      where: eq(tenderDocuments.offerId, offerId),
      with: { uploadedBy: true },
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });

    return res.json(
      ok(
        docs.map((d) => ({
          id: d.id,
          offerId: d.offerId,
          fileName: d.fileName,
          fileSize: d.fileSize,
          mimeType: d.mimeType,
          status: d.status,
          confidence: d.confidence,
          pageCount: d.pageCount,
          ocrRequired: d.ocrRequired,
          ocrDone: d.ocrDone,
          errorMessage: d.errorMessage,
          uploadedBy: d.uploadedBy
            ? { id: (d.uploadedBy as any).id, email: (d.uploadedBy as any).email }
            : null,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        })),
      ),
    );
  } catch (error) {
    console.error("[TENDER-LIST]", error);
    return res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

/**
 * GET /api/tender-documents/:offerId/status
 * Retourne le statut d'extraction de tous les documents d'une offre.
 * Utile pour le polling côté frontend.
 */
router.get("/:offerId/status", async (req, res) => {
  try {
    const { offerId } = req.params;

    const docs = await db
      .select({
        id: tenderDocuments.id,
        status: tenderDocuments.status,
        confidence: tenderDocuments.confidence,
        errorMessage: tenderDocuments.errorMessage,
        updatedAt: tenderDocuments.updatedAt,
      })
      .from(tenderDocuments)
      .where(eq(tenderDocuments.offerId, offerId));

    const itemCount = await db.query.offerItems.findMany({
      where: eq(offerItems.offerId, offerId),
    });

    return res.json(
      ok({
        documents: docs,
        offerItemsCount: itemCount.length,
        allExtracted: docs.every((d) => d.status === "extracted"),
        hasFailed: docs.some((d) => d.status === "failed"),
      }),
    );
  } catch (error) {
    return res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

/**
 * GET /api/tender-documents/document/:documentId/preview
 * Retourne le JSON extrait + texte brut pour aperçu.
 */
router.get("/document/:documentId/preview", async (req, res) => {
  try {
    const { documentId } = req.params;

    const doc = await db.query.tenderDocuments.findFirst({
      where: eq(tenderDocuments.id, documentId),
    });

    if (!doc) {
      return res.status(404).json({ success: false, error: "Document introuvable." });
    }

    return res.json(
      ok({
        id: doc.id,
        fileName: doc.fileName,
        status: doc.status,
        confidence: doc.confidence,
        extractedJson: doc.extractedJson,
        rawTextPreview: doc.extractedText?.slice(0, 3000) ?? null,
        pageCount: doc.pageCount,
      }),
    );
  } catch (error) {
    return res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

/**
 * POST /api/tender-documents/document/:documentId/reprocess
 * Relance l'extraction (force) — utile si le premier essai a échoué.
 */
router.post(
  "/document/:documentId/reprocess",
  requireRole(["admin", "agent_commercial", "technique"]),
  async (req, res) => {
    try {
      const { documentId } = req.params;

      const doc = await db.query.tenderDocuments.findFirst({
        where: eq(tenderDocuments.id, documentId),
      });

      if (!doc) {
        return res.status(404).json({ success: false, error: "Document introuvable." });
      }

      // Re-enqueue
      await tenderExtractionQueue.add(
        "extract-tender",
        { documentId },
        {
          jobId: `tender-reprocess-${documentId}-${Date.now()}`,
          attempts: 2,
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );

      return res.json(ok({ message: "Retraitement lancé.", documentId }));
    } catch (error) {
      return res.status(500).json({ success: false, error: "Erreur serveur" });
    }
  },
);

/**
 * POST /api/tender-documents/document/:documentId/apply
 * Applique l'extraction (crée/remplace les offerItems) même si des items existent déjà.
 * L'utilisateur confirme explicitement depuis le frontend.
 */
router.post(
  "/document/:documentId/apply",
  requireRole(["admin", "agent_commercial", "technique"]),
  async (req, res) => {
    try {
      const { documentId } = req.params;

      const doc = await db.query.tenderDocuments.findFirst({
        where: eq(tenderDocuments.id, documentId),
      });

      if (!doc) {
        return res.status(404).json({ success: false, error: "Document introuvable." });
      }

      if (doc.status !== "extracted" || !doc.extractedJson) {
        return res.status(400).json({
          success: false,
          error: "Ce document n'a pas encore été extrait avec succès.",
        });
      }

      const products = (doc.extractedJson as any).products ?? [];

      if (products.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Aucun article trouvé dans l'extraction.",
        });
      }

      // Delete existing items and recreate
      await db.delete(offerItems).where(eq(offerItems.offerId, doc.offerId));

      const newItems = products.map((p: any) => ({
        offerId: doc.offerId,
        itemNumber: p.itemNumber,
        code: p.code ?? null,
        name: p.designation,
        description: p.unite ? `Unité: ${p.unite}` : null,
        requestedQuantity: p.quantity,
        technicalRequirements: (p.specifications ?? []).map((spec: string) => ({
          label: spec,
          required: true,
          weight: Math.round(100 / Math.max(1, (p.specifications ?? []).length)),
        })),
        minConformityPercentage: 70,
      }));

      await db.insert(offerItems).values(newItems);

      return res.json(
        ok({
          message: `${newItems.length} articles appliqués à l'offre.`,
          itemsCreated: newItems.length,
          offerId: doc.offerId,
        }),
      );
    } catch (error) {
      console.error("[TENDER-APPLY]", error);
      return res.status(500).json({ success: false, error: "Erreur serveur" });
    }
  },
);

/**
 * DELETE /api/tender-documents/document/:documentId
 * Supprime un document (et son fichier).
 */
router.delete(
  "/document/:documentId",
  requireRole(["admin", "agent_commercial"]),
  async (req, res) => {
    try {
      const { documentId } = req.params;

      const doc = await db.query.tenderDocuments.findFirst({
        where: eq(tenderDocuments.id, documentId),
      });

      if (!doc) {
        return res.status(404).json({ success: false, error: "Document introuvable." });
      }

      // Delete file from disk
      if (fs.existsSync(doc.filePath)) {
        fs.unlinkSync(doc.filePath);
      }

      await db.delete(tenderDocuments).where(eq(tenderDocuments.id, documentId));

      return res.json(ok({ message: "Document supprimé.", documentId }));
    } catch (error) {
      return res.status(500).json({ success: false, error: "Erreur serveur" });
    }
  },
);

export default router;
