// services/email/recupere/workers.ts
import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { fetchSupplierEmails } from "./mail.service";
import { bestOfferExcelQueue, documentVerificationQueue, mailFetchQueue, offerRankingQueue, redisConnection, supplierAnalysisQueue, } from "./queues";
import { processSupplierResponsePipeline, recomputeOfferSupplierRanking, } from "./analysis.pipeline";
import { generateBestOfferExport } from "./best-offer.service";
import { db } from "../../../db/drizzle";
import { documentVerifications, notifications, offerExcelExports, supplierResponses, } from "../../../db/schema";
import { analyzeDocumentForStamp } from "../../document-verification.service";
export function startEmailWorkers() {
    new Worker(mailFetchQueue.name, async () => {
        const result = await fetchSupplierEmails();
        if (result.skipped) {
            return result;
        }
        for (const supplierResponseId of result.createdResponseIds ?? []) {
            await supplierAnalysisQueue.add("analyze-supplier-response", {
                supplierResponseId,
            }, {
                jobId: `analyze-${supplierResponseId}`,
                attempts: 3,
                backoff: {
                    type: "exponential",
                    delay: 30000,
                },
                removeOnComplete: 500,
                removeOnFail: 500,
            });
        }
        return result;
    }, {
        connection: redisConnection,
        concurrency: 1,
        lockDuration: 120000,
    });
    new Worker(supplierAnalysisQueue.name, async (job) => {
        const { supplierResponseId } = job.data;
        const result = await processSupplierResponsePipeline(supplierResponseId, {
            force: true,
        });
        const response = await db.query.supplierResponses.findFirst({
            where: eq(supplierResponses.id, supplierResponseId),
        });
        if (response?.offerId) {
            await offerRankingQueue.add("recompute-offer-ranking", {
                offerId: response.offerId,
            }, {
                jobId: `ranking-${response.offerId}-${Date.now()}`,
                attempts: 3,
                backoff: {
                    type: "exponential",
                    delay: 20000,
                },
                removeOnComplete: 200,
                removeOnFail: 200,
            });
            await bestOfferExcelQueue.add("generate-best-offer-excel", {
                offerId: response.offerId,
            }, {
                jobId: `best-offer-excel-${response.offerId}-${Date.now()}`,
                attempts: 2,
                backoff: {
                    type: "exponential",
                    delay: 30000,
                },
                removeOnComplete: 100,
                removeOnFail: 200,
            });
        }
        return result;
    }, {
        connection: redisConnection,
        // Start with 2. Increase later if OpenAI/OCR/database can handle it.
        concurrency: Number(process.env.SUPPLIER_ANALYSIS_CONCURRENCY ?? 2),
        // Long because OCR + AI can take time.
        lockDuration: 10 * 60 * 1000,
    });
    new Worker(offerRankingQueue.name, async (job) => {
        const { offerId } = job.data;
        return await recomputeOfferSupplierRanking(offerId);
    }, {
        connection: redisConnection,
        concurrency: 2,
        lockDuration: 120000,
    });
    new Worker(bestOfferExcelQueue.name, async (job) => {
        const { offerId } = job.data;
        const result = await generateBestOfferExport(offerId);
        await db.insert(offerExcelExports).values({
            offerId,
            fileName: result.fileName,
            filePath: result.filePath,
        });
        return result;
    }, {
        connection: redisConnection,
        concurrency: 1,
        lockDuration: 180000,
    });
    // ── Document Verification Worker ──────────────────────────────────────────
    new Worker(documentVerificationQueue.name, async (job) => {
        const { filePath, fileName, mimeType, documentType, referenceId, verifiedBy, offerId, supplierId, supplierResponseId, } = job.data;
        console.log(`[DOC-VERIFY-WORKER] Analyzing ${fileName} (${documentType})`);
        const result = await analyzeDocumentForStamp(filePath, mimeType, {
            pageStrategy: "last",
            approvalThreshold: 0.75,
        });
        // Persist result
        const status = result.isApproved
            ? "approved"
            : result.stampDetected
                ? "needs_review"
                : "rejected";
        await db.insert(documentVerifications).values({
            documentType,
            referenceId: referenceId ?? null,
            filePath,
            fileName,
            mimeType,
            status: status,
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
            verifiedBy: verifiedBy ?? null,
        });
        // Create notification
        if (offerId) {
            const notificationType = result.isApproved
                ? "checklist_item_complete"
                : "manual_review_required";
            const title = result.isApproved
                ? "Document approuvé — Cachet détecté"
                : "Document nécessite une vérification — Cachet non détecté";
            const message = result.isApproved
                ? `Le document "${fileName}" a été approuvé automatiquement. Cachet officiel détecté (confiance: ${Math.round(result.confidence * 100)}%).`
                : `Le document "${fileName}" n'a pas pu être approuvé. ${result.approvalReason}`;
            await db.insert(notifications).values({
                type: notificationType,
                offerId,
                supplierId: supplierId ?? null,
                supplierResponseId: supplierResponseId ?? null,
                title,
                message,
                isRead: false,
            });
        }
        return {
            fileName,
            isApproved: result.isApproved,
            confidence: result.confidence,
            stampDetected: result.stampDetected,
            status,
        };
    }, {
        connection: redisConnection,
        concurrency: 2,
        lockDuration: 5 * 60 * 1000, // 5 min — vision API can be slow
    });
}
//# sourceMappingURL=workers.js.map