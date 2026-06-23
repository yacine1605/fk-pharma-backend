type PipelineResult = {
    supplierResponseId: string;
    status: "analyzed" | "needs_review" | "failed";
    message: string;
};
export declare function processSupplierResponsePipeline(supplierResponseId: string, options: {
    force?: boolean;
}): Promise<PipelineResult>;
export declare function runPendingSupplierResponsesPipeline(): Promise<{
    queued: number;
}>;
export declare function enqueuePendingSupplierResponsesPipeline(): Promise<{
    queued: number;
}>;
export declare function processOfferAnalysisPipeline(offerId: string): Promise<PipelineResult[]>;
export declare function recomputeOfferSupplierRanking(offerId: string): Promise<{
    global: {
        supplierResponseId: string;
        supplierId: string;
        technicalScore: number;
        priceScore: number;
        conditionsScore: number;
        globalScore: number;
        totalHT: number;
        totalTVA: number;
        totalTTC: number;
        isEligible: boolean;
        rejectionReason: string | null;
        summary: string;
    }[];
    moinsDisant: {
        supplierResponseId: string;
        supplierId: string;
        technicalScore: number;
        priceScore: number;
        conditionsScore: number;
        globalScore: number;
        totalHT: number;
        totalTVA: number;
        totalTTC: number;
        isEligible: boolean;
        rejectionReason: string | null;
        summary: string;
    }[];
    mieuxDisant: {
        supplierResponseId: string;
        supplierId: string;
        technicalScore: number;
        priceScore: number;
        conditionsScore: number;
        globalScore: number;
        totalHT: number;
        totalTVA: number;
        totalTTC: number;
        isEligible: boolean;
        rejectionReason: string | null;
        summary: string;
    }[];
}>;
export {};
//# sourceMappingURL=analysis.pipeline.d.ts.map