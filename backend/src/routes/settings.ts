import { Router } from "express";
import { AuthRequest } from "../middleware/auth.js";

const router: Router = Router();

router.get(
  "/",
  async (
    req: AuthRequest,
    res: { json: (arg0: { message: string }) => void },
  ) => {
    res.json({ message: "Get settings - Phase 6" });
  },
);

router.put(
  "/",
  async (
    req: AuthRequest,
    res: { json: (arg0: { message: string }) => void },
  ) => {
    res.json({ message: "Update settings - Phase 6" });
  },
);

router.get(
  "/ai-models",
  async (
    req: AuthRequest,
    res: { json: (arg0: { models: { id: string; name: string }[] }) => void },
  ) => {
    res.json({
      models: [
        { id: "openai/gpt-5-mini", name: "GPT-5 Mini" },
        { id: "anthropic/claude-opus-4.6", name: "Claude Opus 4.6" },
        { id: "google/gemini-3-flash", name: "Gemini 3 Flash" },
      ],
    });
  },
);

export default router;
