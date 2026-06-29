export type StampType = "official_round" | "rectangular" | "ink_stamp" | "digital" | "none";
export type SignatureType = "handwritten" | "digital_typed" | "none";
export type DocumentQuality = "clear" | "blurry" | "unreadable";
export type DocumentVerificationResult = {
    isApproved: boolean;
    confidence: number;
    stampDetected: boolean;
    signatureDetected: boolean;
    stampType: StampType;
    signatureType: SignatureType;
    documentQuality: DocumentQuality;
    approvalReason: string;
    pagesAnalyzed: number;
    details: {
        stampLocation: string;
        signatureLocation: string;
        hasCompanyInfo: boolean;
        hasDate: boolean;
    };
};
export type VerificationOptions = {
    /** Which pages to analyze for PDFs: "all", "first", "last", "first_and_last" */
    pageStrategy?: "all" | "first" | "last" | "first_and_last";
    /** Minimum confidence threshold for auto-approval (default: 0.75) */
    approvalThreshold?: number;
    /** Max pages to analyze (prevents runaway costs on huge PDFs) */
    maxPages?: number;
};
export declare function analyzeDocumentForStamp(filePath: string, mimeType: string, options?: VerificationOptions): Promise<DocumentVerificationResult>;
//# sourceMappingURL=document-verification.service.d.ts.map