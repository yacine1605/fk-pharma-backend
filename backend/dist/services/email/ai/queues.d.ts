import { Queue } from "bullmq";
import IORedis from "ioredis";
export declare const redisConnection: IORedis;
export declare const mailFetchQueue: Queue<any, any, string, any, any, string>;
export declare const supplierAnalysisQueue: Queue<any, any, string, any, any, string>;
export declare const offerRankingQueue: Queue<any, any, string, any, any, string>;
export declare const bestOfferExcelQueue: Queue<any, any, string, any, any, string>;
export declare const tenderExtractionQueue: Queue<any, any, string, any, any, string>;
export declare const documentVerificationQueue: Queue<any, any, string, any, any, string>;
//# sourceMappingURL=queues.d.ts.map