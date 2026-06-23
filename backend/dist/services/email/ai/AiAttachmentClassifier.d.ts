export type AttachmentClassification = "proforma" | "technical_sheet" | "catalog" | "spreadsheet" | "document" | "image" | "spreadsheet" | "other";
type AttachmentClassificationResult = {
    type: AttachmentClassification;
    confidence: number;
    reason?: string;
};
export declare function buildAttachmentClassificationPrompt(params: {
    fileName: string;
    mimeType?: string;
    extractedText?: string;
}): string;
export declare function safeParseAttachmentClassification(content: string): AttachmentClassificationResult | null;
export declare function classifyAttachmentWithAI(params: {
    fileName: string;
    mimeType?: string | null;
    extractedText?: string;
}): Promise<AttachmentClassificationResult>;
export {};
//# sourceMappingURL=AiAttachmentClassifier.d.ts.map