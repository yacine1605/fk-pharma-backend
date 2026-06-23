import { Worker } from "bullmq";
import { tenderExtractionQueue, redisConnection } from "../email/ai/queues";
import { processTenderDocument } from "./tender-extraction.service";

export function startTenderExtractionWorker() {
  new Worker(
    tenderExtractionQueue.name,
    async (job) => {
      const { documentId } = job.data as { documentId: string };

      console.log(`[TENDER-WORKER] Processing document: ${documentId}`);

      const result = await processTenderDocument(documentId);

      console.log(
        `[TENDER-WORKER] Done: ${result.itemsCreated} articles créés, confiance: ${(result.confidence * 100).toFixed(0)}%`,
      );

      return result;
    },
    {
      connection: redisConnection as any,
      concurrency: 2,
      lockDuration: 10 * 60 * 1000, // 10 min — OCR peut être long
    },
  );

  console.log("[INIT] Tender Extraction Worker démarré.");
}
