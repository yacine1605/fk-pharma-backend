import { Router } from "express";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "../../../db/drizzle";
import { supplierResponseAttachments } from "../../../db/schema";
export const filesRouter = Router();
filesRouter.get("/:attachmentId", async (req, res) => {
    try {
        const { attachmentId } = req.params;
        const attachment = await db.query.supplierResponseAttachments.findFirst({
            where: eq(supplierResponseAttachments.id, attachmentId),
        });
        if (!attachment) {
            return res.status(404).json({
                success: false,
                message: "Fichier introuvable.",
            });
        }
        return res.download(path.resolve(attachment.filePath), attachment.originalFileName);
    }
    catch (error) {
        console.error("[FILES DOWNLOAD]", error);
        return res.status(500).json({
            success: false,
            message: "Erreur serveur",
        });
    }
});
//# sourceMappingURL=filesrouter.js.map