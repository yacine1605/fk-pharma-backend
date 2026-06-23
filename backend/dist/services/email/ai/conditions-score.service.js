/**
 * conditions-score.service.ts
 * Score des conditions commerciales (délai, validité, paiement)
 * SOURCE UNIQUE - Supprime le doublon score_global_fournisseur.ts
 */
/**
 * Calcule le score des conditions commerciales (0-100)
 *
 * @param params - Conditions commerciales du fournisseur
 * @returns Score et détails par critère
 */
export function calculateConditionsScore(params) {
    const result = calculateConditionsScoreDetailed(params);
    return result.score;
}
/**
 * Calcule le score détaillé des conditions commerciales
 */
export function calculateConditionsScoreDetailed(params) {
    const { validityDays, deliveryDelayDays, paymentTerms } = params;
    // ── Validité de l'offre (0-40 points) ──
    let validityScore = 0;
    if (validityDays !== null) {
        if (validityDays >= 60)
            validityScore = 40;
        else if (validityDays >= 30)
            validityScore = 30;
        else if (validityDays >= 15)
            validityScore = 20;
        else if (validityDays >= 7)
            validityScore = 10;
        else
            validityScore = 5;
    }
    // ── Délai de livraison (0-35 points) ──
    let deliveryScore = 0;
    if (deliveryDelayDays !== null) {
        if (deliveryDelayDays <= 7)
            deliveryScore = 35;
        else if (deliveryDelayDays <= 14)
            deliveryScore = 25;
        else if (deliveryDelayDays <= 30)
            deliveryScore = 15;
        else if (deliveryDelayDays <= 60)
            deliveryScore = 10;
        else
            deliveryScore = 5;
    }
    else {
        // Si non spécifié, score neutre
        deliveryScore = 15;
    }
    // ── Conditions de paiement (0-25 points) ──
    let paymentScore = 0;
    if (paymentTerms) {
        const terms = paymentTerms.toLowerCase();
        if (terms.includes("30 jours") || terms.includes("30 days"))
            paymentScore = 25;
        else if (terms.includes("60 jours") || terms.includes("60 days"))
            paymentScore = 20;
        else if (terms.includes("comptant") || terms.includes("cash"))
            paymentScore = 10;
        else if (terms.includes("à réception") || terms.includes("on delivery"))
            paymentScore = 15;
        else
            paymentScore = 12; // Conditions non standard
    }
    else {
        paymentScore = 10; // Non spécifié
    }
    const totalScore = Math.round(validityScore + deliveryScore + paymentScore);
    return {
        score: Math.min(100, totalScore),
        details: {
            validityScore,
            deliveryScore,
            paymentScore,
        },
    };
}
/**
 * Évalue si les conditions sont acceptables pour un marché public
 */
export function areConditionsAcceptable(params, minScore = 50) {
    const result = calculateConditionsScoreDetailed(params);
    const reasons = [];
    if (result.details.validityScore < 20) {
        reasons.push("Validité de l'offre insuffisante (< 15 jours)");
    }
    if (result.details.deliveryScore < 15) {
        reasons.push("Délai de livraison trop long (> 30 jours)");
    }
    if (result.details.paymentScore < 10) {
        reasons.push("Conditions de paiement défavorables");
    }
    return {
        acceptable: result.score >= minScore,
        reasons,
    };
}
//# sourceMappingURL=conditions-score.service.js.map