/**
 * Normalise une chaîne pour la comparaison
 * - minuscules
 * - sans accents
 * - sans caractères spéciaux superflus
 */
export declare function normalizeText(str: string): string;
/**
 * Extrait un nombre d'une chaîne (prix, quantité)
 */
export declare function extractNumber(str: string | number): number | null;
/**
 * Formate un prix en DA
 */
export declare function formatPrice(value: number | null): string;
//# sourceMappingURL=helpers.d.ts.map