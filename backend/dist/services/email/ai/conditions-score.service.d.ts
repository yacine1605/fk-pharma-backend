/**
 * conditions-score.service.ts
 * Score des conditions commerciales (délai, validité, paiement)
 * SOURCE UNIQUE - Supprime le doublon score_global_fournisseur.ts
 */
export interface ConditionsScoreInput {
    validityDays: number | null;
    deliveryDelayDays: number | null;
    paymentTerms: string | null;
}
export interface ConditionsScoreResult {
    score: number;
    details: {
        validityScore: number;
        deliveryScore: number;
        paymentScore: number;
    };
}
/**
 * Calcule le score des conditions commerciales (0-100)
 *
 * @param params - Conditions commerciales du fournisseur
 * @returns Score et détails par critère
 */
export declare function calculateConditionsScore(params: ConditionsScoreInput): number;
/**
 * Calcule le score détaillé des conditions commerciales
 */
export declare function calculateConditionsScoreDetailed(params: ConditionsScoreInput): ConditionsScoreResult;
/**
 * Évalue si les conditions sont acceptables pour un marché public
 */
export declare function areConditionsAcceptable(params: ConditionsScoreInput, minScore?: number): {
    acceptable: boolean;
    reasons: string[];
};
//# sourceMappingURL=conditions-score.service.d.ts.map