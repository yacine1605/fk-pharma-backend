// services/email/recupere/queues.ts

import { Queue } from "bullmq";
import IORedis from "ioredis";

export const redisConnection = new IORedis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
  },
);

export const mailFetchQueue = new Queue("mail-fetch", {
  connection: redisConnection,
});

export const supplierAnalysisQueue = new Queue("supplier-analysis", {
  connection: redisConnection,
});

export const offerRankingQueue = new Queue("offer-ranking", {
  connection: redisConnection,
});

export const bestOfferExcelQueue = new Queue("best-offer-excel", {
  connection: redisConnection,
});
