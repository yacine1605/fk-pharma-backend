declare const pdfParse: any;
declare const OpenAI: any;
declare const openai: any;
declare const model: string;
declare function toNumber(val: any): number | null;
declare function extractWithMistralOCR(pdfBuffer: Buffer): Promise<string>;
declare function structureWithAI(rawText: string, supplierName: string): Promise<any[]>;
declare function extractProductsFromPDF(pdfBuffer: Buffer, supplierName: string): Promise<any[]>;
//# sourceMappingURL=ocrService.d.ts.map