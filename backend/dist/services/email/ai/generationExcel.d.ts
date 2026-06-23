type RankedOffer = {
    rank: number;
    supplierName: string;
    priceHT?: number;
    tva?: number;
    priceTTC?: number;
    conformityPercentage?: number;
    conditionsScore?: number;
    globalScore?: number;
    proformaUrl?: string;
    technicalSheetUrl?: string;
};
export declare function generateRankingExcel(lotId: string, offers: RankedOffer[]): Promise<string>;
export {};
//# sourceMappingURL=generationExcel.d.ts.map