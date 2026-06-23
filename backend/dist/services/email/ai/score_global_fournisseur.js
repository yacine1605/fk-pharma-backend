export function calculateConditionsScore(params) {
    let score = 0;
    // ─────────────────────────────────────────────
    // VALIDITY SCORE
    // ─────────────────────────────────────────────
    if (typeof params.validityDays === "number") {
        if (params.validityDays >= 30) {
            score += 40;
        }
        else if (params.validityDays >= 15) {
            score += 25;
        }
        else {
            score += 10;
        }
    }
    // ─────────────────────────────────────────────
    // DELIVERY DELAY SCORE
    // ─────────────────────────────────────────────
    if (typeof params.deliveryDelayDays === "number") {
        if (params.deliveryDelayDays <= 7) {
            score += 40;
        }
        else if (params.deliveryDelayDays <= 15) {
            score += 30;
        }
        else if (params.deliveryDelayDays <= 30) {
            score += 20;
        }
        else {
            score += 10;
        }
    }
    else {
        // Unknown delivery delay
        score += 10;
    }
    // ─────────────────────────────────────────────
    // PAYMENT TERMS SCORE
    // ─────────────────────────────────────────────
    if (params.paymentTerms) {
        const normalized = params.paymentTerms
            .toLowerCase()
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "");
        // Better conditions
        if (normalized.includes("credit") ||
            normalized.includes("30 jours") ||
            normalized.includes("60 jours") ||
            normalized.includes("virement apres livraison")) {
            score += 20;
        }
        // Medium conditions
        else if (normalized.includes("cheque") || normalized.includes("traite")) {
            score += 15;
        }
        // Weak conditions
        else if (normalized.includes("comptant") ||
            normalized.includes("immediat") ||
            normalized.includes("avance")) {
            score += 5;
        }
        // Unknown but present
        else {
            score += 10;
        }
    }
    // ─────────────────────────────────────────────
    // FINAL SCORE
    // ─────────────────────────────────────────────
    return Math.max(0, Math.min(score, 100));
}
//# sourceMappingURL=score_global_fournisseur.js.map