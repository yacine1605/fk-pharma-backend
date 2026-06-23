import { Router } from "express";
import { documentService } from "../services/documentService.js";
import { z } from "zod";
const router = Router();
router.get("/", async (req, res) => {
    try {
        const documents = await documentService.getAllDocuments(req.userId);
        res.json(documents);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get("/:id", async (req, res) => {
    try {
        const document = await documentService.getDocumentById(req.params.id, req.userId);
        res.json(document);
    }
    catch (error) {
        res.status(404).json({ error: error.message });
    }
});
router.post("/analyze-pdf", async (req, res) => {
    res.json({ message: "PDF analysis - coming soon with document parsing" });
});
router.put("/:id/status", async (req, res) => {
    try {
        const { status } = z
            .object({
            status: z.enum(["draft", "generated", "validated", "signed"]),
        })
            .parse(req.body);
        const document = await documentService.updateDocumentStatus(req.params.id, req.userId, status);
        res.json(document);
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.errors[0].message });
        }
        else {
            res.status(400).json({ error: error.message });
        }
    }
});
router.delete("/:id", async (req, res) => {
    try {
        await documentService.deleteDocument(req.params.id, req.userId);
        res.json({ message: "Document deleted successfully" });
    }
    catch (error) {
        if (error.message === "Document not found") {
            res.status(404).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: error.message });
        }
    }
});
export default router;
//# sourceMappingURL=documents.js.map