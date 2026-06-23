import { Router } from "express";
const router = Router();
router.get("/", async (req, res) => {
    res.json({ message: "Get settings - Phase 6" });
});
router.put("/", async (req, res) => {
    res.json({ message: "Update settings - Phase 6" });
});
router.get("/ai-models", async (req, res) => {
    res.json({
        models: [
            { id: "openai/gpt-5-mini", name: "GPT-5 Mini" },
            { id: "anthropic/claude-opus-4.6", name: "Claude Opus 4.6" },
            { id: "google/gemini-3-flash", name: "Gemini 3 Flash" },
        ],
    });
});
export default router;
//# sourceMappingURL=settings.js.map