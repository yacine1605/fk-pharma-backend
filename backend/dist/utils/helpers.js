/**
 * Normalise une chaîne pour la comparaison
 * - minuscules
 * - sans accents
 * - sans caractères spéciaux superflus
 */
export function normalizeText(str) {
    if (!str)
        return "";
    return str
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
/**
 * Extrait un nombre d'une chaîne (prix, quantité)
 */
export function extractNumber(str) {
    if (typeof str === "number")
        return str;
    if (!str)
        return null;
    const cleaned = str.toString().replace(/\s/g, "").replace(/,/g, ".");
    const match = cleaned.match(/[0-9]+(?:\.[0-9]+)?/);
    return match ? parseFloat(match[0]) : null;
}
/**
 * Formate un prix en DA
 */
export function formatPrice(value) {
    if (value == null)
        return "-";
    return `${value.toLocaleString("fr-DZ")} DA`;
}
//# sourceMappingURL=helpers.js.map