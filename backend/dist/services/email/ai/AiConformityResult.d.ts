type AiConformityDetail = {
    requirementLabel: string;
    required: boolean;
    weight: number;
    matched: boolean;
    score: number;
    evidence: string | null;
    comment: string | null;
};
type AiConformityResult = {
    offerItemId: string;
    requestedProductName: string;
    proposedProductName: string | null;
    proposedProductCode: string | null;
    proposedBrand: string | null;
    quantityRequested: number | null;
    quantityOffered: number | null;
    conformityPercentage: number;
    isTechnicallyCompliant: boolean;
    mandatoryMissingCount: number;
    details: AiConformityDetail[];
    summary: string;
    recommendation: string;
};
export declare const genericEquivalenceGroups: string[][];
export declare function canonicalizeGenericText(value: string): string;
export declare function genericEquivalenceScore(a: string, b: string): number;
export declare function areGenericEquivalent(a: string, b: string): boolean;
export declare function buildConformityPrompt(params: {
    requestedItem: {
        id: string;
        name: string;
        requestedQuantity: number;
        technicalRequirements: unknown;
    };
    proformaText: string;
    technicalText: string;
}): string;
export declare function normalizeText(value: string): string;
export declare function safeParseConformity(content: string): AiConformityResult | null;
export type ProductFamily = "defibrillator" | "ecg" | "mobile_monitoring_kit" | "patient_monitor" | "unknown";
export declare function detectProductFamily(value: string): ProductFamily;
export declare function normalizeToken(token: string): string;
export declare function similarityScore(source: string, target: string): number;
export {};
//# sourceMappingURL=AiConformityResult.d.ts.map