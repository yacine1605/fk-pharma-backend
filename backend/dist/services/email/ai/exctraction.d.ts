export declare function extractTextFromPdf(filePath: string): Promise<any>;
export declare function extractTextSmart(filePath: string): Promise<{
    text: any;
    method: "pdf_text";
    ocrRequired: boolean;
    pages: any;
} | {
    text: string;
    method: "ocr";
    ocrRequired: boolean;
    pages: number;
}>;
export declare function extractTextFromDocx(filePath: string): Promise<string>;
export type ExtractedOfferData = {
    priceHT?: number;
    tva?: number;
    priceTTC?: number;
    currency?: string;
    deliveryDelayDays?: number;
    warrantyMonths?: number;
    validityDays?: number;
};
export declare function extractTextFromExcel(filePath: string): Promise<string>;
export declare function extractOfferData(text: string): ExtractedOfferData;
//# sourceMappingURL=exctraction.d.ts.map