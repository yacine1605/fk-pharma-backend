export type PricingExcelLine = {
    supplierName?: string;
    lot?: string | number;
    product: string;
    unitPrice: number;
    quantity: number;
    marginRate: number;
    tvaRate: number;
};
type GeneratePricingExcelParams = {
    offerId: string;
    title: string;
    lines: PricingExcelLine[];
};
export declare function generatePricingExcel(params: GeneratePricingExcelParams): Promise<{
    fileName: string;
    filePath: string;
}>;
export {};
//# sourceMappingURL=excel.service.d.ts.map