import { Router } from "express";
import { bestOfferExcelQueue, mailFetchQueue, offerRankingQueue, supplierAnalysisQueue, } from "./queues";
export const queueStatusRouter = Router();
queueStatusRouter.get("/status", async (_req, res) => {
    const [mailCounts, analysisCounts, rankingCounts, excelCounts] = await Promise.all([
        mailFetchQueue.getJobCounts(),
        supplierAnalysisQueue.getJobCounts(),
        offerRankingQueue.getJobCounts(),
        bestOfferExcelQueue.getJobCounts(),
    ]);
    return res.json({
        success: true,
        queues: {
            mailFetch: mailCounts,
            supplierAnalysis: analysisCounts,
            offerRanking: rankingCounts,
            bestOfferExcel: excelCounts,
        },
    });
});
//# sourceMappingURL=queu.route.js.map