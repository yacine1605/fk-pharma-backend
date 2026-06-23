type AiProformaLine = {
    lineNumber: number | null;
    code: string | null;
    designation: string;
    brand: string | null;
    quantity: number | null;
    unitPriceHT: number | null;
    discountPercentage: number | null;
    totalHT: number | null;
    tvaPercentage: number | null;
};
type AiProformaExtraction = {
    documentType: "proforma";
    supplierName: string | null;
    proformaNumber: string | null;
    proformaDate: string | null;
    customerName: string | null;
    totalHT: number | null;
    totalTVA: number | null;
    stampDuty: number | null;
    totalTTC: number | null;
    currency: string | null;
    paymentTerms: string | null;
    validityText: string | null;
    validityDays: number | null;
    lines: AiProformaLine[];
    confidence: number;
};
export declare function buildProformaPrompt(text: string): string;
export declare function safeParseProforma(content: string): AiProformaExtraction | null;
export {};
//# sourceMappingURL=AiProformaExtraction.d.ts.map