import { Router } from "express";
import multer from "multer";
import fs from "fs";
import { eq } from "drizzle-orm";
import { requireRole } from "../middleware/auth";
import { db } from "../db/drizzle";
import { documentVerifications, tenderDocuments, supplierResponseAttachments, } from "../db/schema";
import { analyzeDocumentForStamp, } from "../services/document-verification.service";
import { documentVerificationQueue } from "../services/email/ai/queues";
const router = Router();
// ─── Multer Config ────────────────────────────────────────────────────────────
const signatureUploadsDir = process.env.SIGNATURE_UPLOADS_DIR ?? "uploads/signatures";
if (!fs.existsSync(signatureUploadsDir)) {
    fs.mkdirSync(signatureUploadsDir, { recursive: true });
}
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, signatureUploadsDir),
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
            "image/png",
            "image/jpeg",
            "image/webp",
            "image/bmp",
            "image/tiff",
        ];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error(`Format non supporté: ${file.mimetype}`));
        }
    },
});
// ─── Helpers ──────────────────────────────────────────────────────────────────
const ok = (data) => ({ success: true, data });
const fail = (message) => ({
    success: false,
    error: message,
});
// ─── POST /api/signature/verify ───────────────────────────────────────────────
// Upload a file directly and get stamp/signature analysis in real-time.
// Returns the full verification result synchronously.
router.post("/verify", requireRole(["admin", "agent_commercial", "technique"]), upload.single("file"), async (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json(fail("Aucun fichier fourni."));
    }
    try {
        const pageStrategy = req.body.pageStrategy || "last";
        const result = await analyzeDocumentForStamp(file.path, file.mimetype, {
            pageStrategy: pageStrategy,
            approvalThreshold: 0.75,
        });
        // Save to document_verifications
        const [verification] = await db
            .insert(documentVerifications)
            .values({
            documentType: "standalone",
            filePath: file.path,
            fileName: file.originalname,
            mimeType: file.mimetype,
            status: result.isApproved ? "approved" : "rejected",
            isApproved: result.isApproved,
            confidence: result.confidence,
            stampDetected: result.stampDetected,
            signatureDetected: result.signatureDetected,
            stampType: result.stampType,
            signatureType: result.signatureType,
            documentQuality: result.documentQuality,
            approvalReason: result.approvalReason,
            pagesAnalyzed: result.pagesAnalyzed,
            analysisDetails: result.details,
            verifiedBy: req.userId ?? null,
        })
            .returning();
        return res.json(ok({
            verificationId: verification.id,
            ...result,
        }));
    }
    catch (error) {
        console.error("[SIGNATURE-VERIFY-ERROR]", error);
        return res.status(500).json(fail(error.message ||
            "Une erreur est survenue lors de l'analyse de la signature."));
    }
    finally {
        // Clean up uploaded file
        try {
            if (file && fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        }
        catch (cleanupErr) {
            console.error("[SIGNATURE-VERIFY-CLEANUP]", cleanupErr);
        }
    }
});
// ─── POST /api/signature/verify-document/:documentId ──────────────────────────
// Verify an existing tender document by its ID.
// Looks up the file in tender_documents, runs stamp analysis, saves result.
router.post("/verify-document/:documentId", requireRole(["admin", "agent_commercial", "technique"]), async (req, res) => {
    try {
        const { documentId } = req.params;
        const doc = await db.query.tenderDocuments.findFirst({
            where: eq(tenderDocuments.id, documentId),
        });
        if (!doc) {
            return res
                .status(404)
                .json(fail("Document introuvable."));
        }
        if (!fs.existsSync(doc.filePath)) {
            return res
                .status(404)
                .json(fail("Le fichier source n'existe plus sur le disque."));
        }
        const pageStrategy = req.body.pageStrategy || "last";
        const result = await analyzeDocumentForStamp(doc.filePath, doc.mimeType ?? "application/pdf", {
            pageStrategy: pageStrategy,
            approvalThreshold: 0.75,
        });
        // Save verification result
        const [verification] = await db
            .insert(documentVerifications)
            .values({
            documentType: "tender_document",
            referenceId: documentId,
            filePath: doc.filePath,
            fileName: doc.fileName,
            mimeType: doc.mimeType,
            status: result.isApproved ? "approved" : result.stampDetected ? "needs_review" : "rejected",
            isApproved: result.isApproved,
            confidence: result.confidence,
            stampDetected: result.stampDetected,
            signatureDetected: result.signatureDetected,
            stampType: result.stampType,
            signatureType: result.signatureType,
            documentQuality: result.documentQuality,
            approvalReason: result.approvalReason,
            pagesAnalyzed: result.pagesAnalyzed,
            analysisDetails: result.details,
            verifiedBy: req.userId ?? null,
        })
            .returning();
        return res.json(ok({
            verificationId: verification.id,
            documentId,
            fileName: doc.fileName,
            ...result,
        }));
    }
    catch (error) {
        console.error("[VERIFY-DOCUMENT-ERROR]", error);
        return res.status(500).json(fail(error.message || "Erreur lors de la vérification du document."));
    }
});
// ─── POST /api/signature/verify-attachment/:attachmentId ──────────────────────
// Verify a supplier response attachment by its ID.
router.post("/verify-attachment/:attachmentId", requireRole(["admin", "agent_commercial", "technique"]), async (req, res) => {
    try {
        const { attachmentId } = req.params;
        const attachment = await db.query.supplierResponseAttachments.findFirst({
            where: eq(supplierResponseAttachments.id, attachmentId),
        });
        if (!attachment) {
            return res
                .status(404)
                .json(fail("Pièce jointe introuvable."));
        }
        if (!fs.existsSync(attachment.filePath)) {
            return res
                .status(404)
                .json(fail("Le fichier source n'existe plus sur le disque."));
        }
        const pageStrategy = req.body.pageStrategy || "last";
        const result = await analyzeDocumentForStamp(attachment.filePath, attachment.mimeType ?? "application/pdf", {
            pageStrategy: pageStrategy,
            approvalThreshold: 0.75,
        });
        // Save verification result
        const [verification] = await db
            .insert(documentVerifications)
            .values({
            documentType: "supplier_attachment",
            referenceId: attachmentId,
            filePath: attachment.filePath,
            fileName: attachment.originalFileName,
            mimeType: attachment.mimeType,
            status: result.isApproved ? "approved" : result.stampDetected ? "needs_review" : "rejected",
            isApproved: result.isApproved,
            confidence: result.confidence,
            stampDetected: result.stampDetected,
            signatureDetected: result.signatureDetected,
            stampType: result.stampType,
            signatureType: result.signatureType,
            documentQuality: result.documentQuality,
            approvalReason: result.approvalReason,
            pagesAnalyzed: result.pagesAnalyzed,
            analysisDetails: result.details,
            verifiedBy: req.userId ?? null,
        })
            .returning();
        return res.json(ok({
            verificationId: verification.id,
            attachmentId,
            fileName: attachment.originalFileName,
            ...result,
        }));
    }
    catch (error) {
        console.error("[VERIFY-ATTACHMENT-ERROR]", error);
        return res.status(500).json(fail(error.message ||
            "Erreur lors de la vérification de la pièce jointe."));
    }
});
// ─── GET /api/signature/verifications/:referenceId ────────────────────────────
// Get all verification results for a given document reference.
router.get("/verifications/:referenceId", async (req, res) => {
    try {
        const { referenceId } = req.params;
        const verifications = await db
            .select()
            .from(documentVerifications)
            .where(eq(documentVerifications.referenceId, referenceId))
            .orderBy(documentVerifications.createdAt);
        return res.json(ok(verifications.map((v) => ({
            id: v.id,
            documentType: v.documentType,
            status: v.status,
            isApproved: v.isApproved,
            confidence: v.confidence,
            stampDetected: v.stampDetected,
            signatureDetected: v.signatureDetected,
            stampType: v.stampType,
            signatureType: v.signatureType,
            documentQuality: v.documentQuality,
            approvalReason: v.approvalReason,
            pagesAnalyzed: v.pagesAnalyzed,
            details: v.analysisDetails,
            createdAt: v.createdAt,
        }))));
    }
    catch (error) {
        console.error("[GET-VERIFICATIONS-ERROR]", error);
        return res.status(500).json(fail("Erreur serveur"));
    }
});
// ─── POST /api/signature/bulk-verify ──────────────────────────────────────────
// Enqueue multiple documents for async verification via BullMQ.
// Accepts an array of document IDs (tender_documents) to verify.
router.post("/bulk-verify", requireRole(["admin", "agent_commercial", "technique"]), async (req, res) => {
    try {
        const { documentIds, documentType = "tender_document" } = req.body;
        if (!Array.isArray(documentIds) || documentIds.length === 0) {
            return res
                .status(400)
                .json(fail("documentIds doit être un tableau non vide."));
        }
        if (documentIds.length > 50) {
            return res
                .status(400)
                .json(fail("Maximum 50 documents par lot."));
        }
        const enqueued = [];
        const errors = [];
        for (const docId of documentIds) {
            try {
                let filePath;
                let fileName;
                let mimeType;
                let offerId;
                if (documentType === "tender_document") {
                    const doc = await db.query.tenderDocuments.findFirst({
                        where: eq(tenderDocuments.id, docId),
                    });
                    if (!doc) {
                        errors.push({ id: docId, error: "Document introuvable" });
                        continue;
                    }
                    filePath = doc.filePath;
                    fileName = doc.fileName;
                    mimeType = doc.mimeType ?? "application/pdf";
                    offerId = doc.offerId;
                }
                else if (documentType === "supplier_attachment") {
                    const att = await db.query.supplierResponseAttachments.findFirst({
                        where: eq(supplierResponseAttachments.id, docId),
                    });
                    if (!att) {
                        errors.push({ id: docId, error: "Pièce jointe introuvable" });
                        continue;
                    }
                    filePath = att.filePath;
                    fileName = att.originalFileName;
                    mimeType = att.mimeType ?? "application/pdf";
                }
                else {
                    errors.push({ id: docId, error: "Type de document non supporté" });
                    continue;
                }
                await documentVerificationQueue.add("verify-document-stamp", {
                    filePath,
                    fileName,
                    mimeType,
                    documentType,
                    referenceId: docId,
                    verifiedBy: req.userId,
                    offerId,
                }, {
                    jobId: `verify-${docId}-${Date.now()}`,
                    attempts: 2,
                    backoff: { type: "exponential", delay: 15000 },
                    removeOnComplete: 200,
                    removeOnFail: 200,
                });
                enqueued.push(docId);
            }
            catch (err) {
                errors.push({ id: docId, error: err.message });
            }
        }
        return res.json(ok({
            message: `${enqueued.length} document(s) envoyé(s) pour vérification.`,
            enqueued: enqueued.length,
            failed: errors.length,
            errors: errors.length > 0 ? errors : undefined,
        }));
    }
    catch (error) {
        console.error("[BULK-VERIFY-ERROR]", error);
        return res.status(500).json(fail("Erreur serveur"));
    }
});
export default router;
//# sourceMappingURL=signature.js.map