export type ComparisonExcelRow = {
    product: string;
    lot: string;
    quantity: number;
    unit: string | null;
    supplierName: string;
    unitPriceHT: number;
    tvaRate: number;
    totalHT: number;
    totalTTC: number;
    conformityPercentage: number | null;
    technicalSheetStatus: "existe" | "non_existe";
    isLeastExpensive: boolean;
    isBestValue: boolean;
    deliveryDelayDays: number | null;
    deliveryDelayText: string | null;
    warrantyMonths: number | null;
    warrantyText: string | null;
    afterSalesService: string | null;
    paymentTerms: string | null;
    validityDays: number | null;
    echeance: Date | string | null;
};
export type ComparisonExcelOptions = {
    offerId: string;
    title: string;
    rows: ComparisonExcelRow[];
    offerMeta?: {
        consultationNumber?: string | null;
        establishment?: string | null;
        lotNumber?: string | null;
        lotObject?: string | null;
        technicalDepartmentDepositDate?: Date | null;
    };
};
export declare function generateComparisonExcel(options: ComparisonExcelOptions): Promise<string>;
//# sourceMappingURL=comparisonExcel.d.ts.map