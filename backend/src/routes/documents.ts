import { Router, Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import { documentService } from "../services/documentService.js";

import { z } from "zod";

const router: Router = Router();

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const documents = await documentService.getAllDocuments(req.userId!);
    res.json(documents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const document = await documentService.getDocumentById(
      req.params.id,
      req.userId!,
    );
    res.json(document);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

router.post("/analyze-pdf", async (req: AuthRequest, res: Response) => {
  res.json({ message: "PDF analysis - coming soon with document parsing" });
});

router.put("/:id/status", async (req: AuthRequest, res: Response) => {
  try {
    const { status } = z
      .object({
        status: z.enum(["draft", "generated", "validated", "signed"]),
      })
      .parse(req.body);

    const document = await documentService.updateDocumentStatus(
      req.params.id,
      req.userId!,
      status,
    );
    res.json(document);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
});

router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    await documentService.deleteDocument(req.params.id, req.userId!);
    res.json({ message: "Document deleted successfully" });
  } catch (error: any) {
    if (error.message === "Document not found") {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

export default router;
