export type AiOfferRequirement = {
    label: string;
    required: boolean;
    weight: number;
    value: string | null;
};
export type AiExtractedOfferItem = {
    itemNumber: number;
    lotNumber: number | null;
    lotName: string | null;
    code: string | null;
    name: string;
    description: string | null;
    requestedQuantity: number;
    minQuantity: number | null;
    maxQuantity: number | null;
    unit: string | null;
    minConformityPercentage: number;
    technicalRequirements: AiOfferRequirement[];
};
export type AiOfferItemsExtraction = {
    documentType: "offer_specification";
    items: AiExtractedOfferItem[];
    confidence: number;
    ocrIssues?: {
        itemNumber?: number;
        lotNumber?: number | null;
        issue: string;
        suggestedCorrection?: string | null;
    }[];
};
export declare function buildOfferItemsPrompt(text: string): string;
export declare function safeParseOfferItems(content: string): AiOfferItemsExtraction | null;
export declare function dedupeOfferItems(items: any[]): any[];
//# sourceMappingURL=AiOfferItemsExtraction.d.ts.map