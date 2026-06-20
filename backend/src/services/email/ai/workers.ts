// services/email/recupere/workers.ts

import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { fetchSupplierEmails } from "./mail.service";
import {
  bestOfferExcelQueue,
  mailFetchQueue,
  offerRankingQueue,
  redisConnection,
  supplierAnalysisQueue,
} from "./queues";
import {
  processSupplierResponsePipeline,
  recomputeOfferSupplierRanking,
} from "./analysis.pipeline";
import { generateBestOfferExport } from "./best-offer.service";
import { db } from "../../../db/drizzle";
import { offerExcelExports, supplierResponses } from "../../../db/schema";
import { Option } from "lucide-react";

export function startEmailWorkers() {
  new Worker(
    mailFetchQueue.name,
    async () => {
      const result = await fetchSupplierEmails();

      if (result.skipped) {
        return result;
      }

      for (const supplierResponseId of result.createdResponseIds ?? []) {
        await supplierAnalysisQueue.add(
          "analyze-supplier-response",
          {
            supplierResponseId,
          },
          {
            jobId: `analyze-${supplierResponseId}`,
            attempts: 3,
            backoff: {
              type: "exponential",
              delay: 30_000,
            },
            removeOnComplete: 500,
            removeOnFail: 500,
          },
        );
      }

      return result;
    },
    {
      connection: redisConnection,
      concurrency: 1,
      lockDuration: 120_000,
    },
  );

  new Worker(
    supplierAnalysisQueue.name,
    async (job) => {
      const { supplierResponseId } = job.data as {
        supplierResponseId: string;
      };

      const result = await processSupplierResponsePipeline(supplierResponseId, {
        force: true,
      });

      const response = await db.query.supplierResponses.findFirst({
        where: eq(supplierResponses.id, supplierResponseId),
      });

      if (response?.offerId) {
        await offerRankingQueue.add(
          "recompute-offer-ranking",
          {
            offerId: response.offerId,
          },
          {
            jobId: `ranking-${response.offerId}-${Date.now()}`,
            attempts: 3,
            backoff: {
              type: "exponential",
              delay: 20_000,
            },
            removeOnComplete: 200,
            removeOnFail: 200,
          },
        );

        await bestOfferExcelQueue.add(
          "generate-best-offer-excel",
          {
            offerId: response.offerId,
          },
          {
            jobId: `best-offer-excel-${response.offerId}-${Date.now()}`,
            attempts: 2,
            backoff: {
              type: "exponential",
              delay: 30_000,
            },
            removeOnComplete: 100,
            removeOnFail: 200,
          },
        );
      }

      return result;
    },
    {
      connection: redisConnection,

      // Start with 2. Increase later if OpenAI/OCR/database can handle it.
      concurrency: Number(process.env.SUPPLIER_ANALYSIS_CONCURRENCY ?? 2),

      // Long because OCR + AI can take time.
      lockDuration: 10 * 60 * 1000,
    },
  );

  new Worker(
    offerRankingQueue.name,
    async (job) => {
      const { offerId } = job.data as {
        offerId: string;
      };

      return await recomputeOfferSupplierRanking(offerId);
    },
    {
      connection: redisConnection,
      concurrency: 2,
      lockDuration: 120_000,
    },
  );

  new Worker(
    bestOfferExcelQueue.name,
    async (job) => {
      const { offerId } = job.data as {
        offerId: string;
      };

      const result = await generateBestOfferExport(offerId);

      await db.insert(offerExcelExports).values({
        offerId,
        fileName: result.fileName,
        filePath: result.filePath,
      });

      return result;
    },
    {
      connection: redisConnection,
      concurrency: 1,
      lockDuration: 180_000,
    },
  );
}
