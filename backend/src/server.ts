import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";

// ── Config (loads dotenv) ──
import { ENV } from "./config/env";

// ── Middleware ──
import { authMiddleware } from "./middleware/auth";

// ── Core Routers ──
import authRouter from "./routes/auth";
import offersRouter from "./routes/offers.router";
import suppliersRouter from "./routes/suppliers";
import productsRouter from "./routes/products";
import distributeurRouter from "./routes/distributeur";
import accountingRouter from "./routes/accounting";
// import documentsRouter from "./routes/documents";
import settingsRouter from "./routes/settings";
import userRouter from "./routes/user";

// ── AI/Email Routers ──
import { aiRoute } from "./services/email/ai/airoute";
import { analysisPipelineRouter } from "./services/email/ai/analysis.pipeline.routes";
import { bestOfferRouter } from "./services/email/ai/best-offer.routes";
import excelRouter from "./services/email/ai/excel.routes";
import notificationRouter from "./services/email/ai/notification.routes";
import { mailRouter } from "./services/email/ai/mailRouter";
import { filesRouter } from "./services/email/ai/filesrouter";
import { queueStatusRouter } from "./services/email/ai/queu.route";
import testDeadlineRouter from "./services/email/ai/test-deadline.routes";
import tenderDocumentsRouter from "./routes/tender-documents";
import signatureRouter from "./routes/signature";

// ── Background Jobs / Workers / Cron ──
import { startEmailWorkers } from "./services/email/ai/workers";
import { startMailCron } from "./services/email/ai/mail.cron";
import { startDeadlineCron } from "./services/email/ai/deadline.cron";
import { startTenderExtractionWorker } from "./services/tender/tender-extraction.worker";

const app = express();
const PORT = ENV.PORT || 5000;

// Enable CORS
app.use(
  cors({
    origin: ENV.FRONTEND_ORIGIN,
    credentials: true,
  })
);

// Body parser middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads
const uploadsDir = path.join(process.cwd(), ENV.UPLOADS_DIR);
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

// ── Register Routes ──

// Auth routes (public endpoints registration /login and /register)
app.use("/api/auth", authRouter);

// Apply auth middleware to all remaining API routes
app.use("/api/offers", authMiddleware, offersRouter);
app.use("/api/suppliers", authMiddleware, suppliersRouter);
app.use("/api/products", authMiddleware, productsRouter);
app.use("/api/distributors", authMiddleware, distributeurRouter);
app.use("/api/accounting", authMiddleware, accountingRouter);
// app.use("/api/documents", authMiddleware, documentsRouter);
app.use("/api/settings", authMiddleware, settingsRouter);
app.use("/api/users", authMiddleware, userRouter);

// AI & Email endpoints
app.use("/api", authMiddleware, aiRoute);
app.use("/api/pipeline", authMiddleware, analysisPipelineRouter);
app.use("/api/best-offer", authMiddleware, bestOfferRouter);
app.use("/api/excel", authMiddleware, excelRouter);
app.use("/api/notifications", authMiddleware, notificationRouter);
app.use("/api/mail", authMiddleware, mailRouter);
app.use("/api/files", authMiddleware, filesRouter);
app.use("/api/queue", authMiddleware, queueStatusRouter);
app.use("/api/test-deadline", authMiddleware, testDeadlineRouter);
app.use("/api/tender-documents", authMiddleware, tenderDocumentsRouter);
app.use("/api/signature", authMiddleware, signatureRouter);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    error: err.message || "An unexpected error occurred",
  });
});

// Start workers and crons
try {
  startEmailWorkers();
  console.log("[INIT] BullMQ Workers started.");
} catch (e) {
  console.error("[INIT] Failed to start BullMQ workers:", e);
}

try {
  startMailCron();
  console.log("[INIT] Mail polling Cron job started.");
} catch (e) {
  console.error("[INIT] Failed to start Mail Cron job:", e);
}

try {
  startDeadlineCron();
  console.log("[INIT] Deadline notification Cron jobs started.");
} catch (e) {
  console.error("[INIT] Failed to start Deadline Cron job:", e);
}

try {
  startTenderExtractionWorker();
} catch (e) {
  console.error("[INIT] Failed to start Tender Extraction Worker:", e);
}

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
