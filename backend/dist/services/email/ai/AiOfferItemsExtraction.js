// AiOfferItemsExtraction.ts
import { detectProductFamily } from "./AiConformityResult";
export function buildOfferItemsPrompt(text) {
    return `
Tu es un système d'extraction de données pour marchés publics biomédicaux algériens.

MISSION:
Extraire les ARTICLES/PRODUITS demandés depuis le texte OCR d'un cahier des charges, DQE, BPU ou tableau de fournitures médicales.

RÈGLE PRINCIPALE:
- Si le document contient un tableau avec des lignes de produits, chaque LIGNE DU TABLEAU est un offer item.
- Le titre du lot, par exemple "LOT N°01 : CONSOMMABLES D’HÉMODIALYSE", n'est PAS un offer item.
- Le titre du lot doit être utilisé comme contexte dans les champs "lotNumber" et "lotName".
- Ne transforme jamais un lot entier en un seul item avec tous les produits comme exigences techniques.

DÉTECTION DES LOTS:
- Les titres de lots ressemblent à:
  - "LOT N°01 : CONSOMMABLES D’HÉMODIALYSE"
  - "LOT N°02 : MEDICAMENT D’HEMODIALYSE"
  - "LOT N 03 : PANSEMENTS"
- Extraire:
  - lotNumber: le numéro du lot si visible, sinon null
  - lotName: le titre exact du lot après les deux-points, sinon le titre complet visible

DÉTECTION DES ARTICLES DANS LES TABLEAUX:
- Les articles sont les lignes situées sous les colonnes comme:
  - N°
  - DESIGNATION DES PRODUITS
  - DCI
  - UNT / UNITE
  - Qte MIN
  - Qte MAX
  - PRIX UNITAIRE
  - MONTANT
- Chaque ligne numérotée du tableau est un item séparé.
- Le champ "itemNumber" correspond au numéro de ligne dans le tableau.
- Le champ "name" doit être la désignation exacte du produit dans la colonne "DESIGNATION DES PRODUITS PAR DCI".
- Le champ "unit" correspond à la colonne "UNT" ou "UNITE".
- Le champ "minQuantity" correspond à "Qte MIN".
- Le champ "maxQuantity" correspond à "Qte MAX".
- Le champ "requestedQuantity" doit être:
  - égal à maxQuantity si Qte MAX existe
  - sinon égal à minQuantity si Qte MIN existe
  - sinon 1

TRANSCRIPTION STRICTE:
- Copier les noms tels qu'ils apparaissent dans le texte OCR.
- Ne pas corriger, reformuler ou deviner.
- Si l'OCR contient une erreur, garder l'erreur dans "name".
- Ne jamais utiliser le titre du lot comme "name" d'un item si des lignes de tableau existent.

EXIGENCES TECHNIQUES:
- Pour les lignes de tableau simples, mettre "technicalRequirements": [].
- N’utiliser "technicalRequirements" que si un article a des caractéristiques techniques détaillées sous sa désignation.
- Ne pas mettre les autres lignes du tableau comme exigences techniques d’un lot.

GESTION DES QUANTITÉS:
- Convertir les quantités numériques en nombres.
- Si une quantité est illisible, mettre null dans minQuantity/maxQuantity si le champ existe.
- requestedQuantity doit toujours être un nombre. Si aucune quantité fiable n’est visible, utiliser 1.

Texte OCR du document:
"""
${text}
"""

Format de sortie JSON uniquement:
{
  "documentType": "offer_specification",
  "items": [
    {
      "itemNumber": 1,
      "lotNumber": 1,
      "lotName": "CONSOMMABLES D’HÉMODIALYSE",
      "code": null,
      "name": "ACIDE CITRIQUE",
      "description": null,
      "requestedQuantity": 10,
      "minQuantity": 8,
      "maxQuantity": 10,
      "unit": "SACHET/P 5 KG",
      "minConformityPercentage": 70,
      "technicalRequirements": []
    }
  ],
  "confidence": 0.95,
  "ocrIssues": []
}

Règles de conformité:
- Retourne UNIQUEMENT du JSON valide, sans markdown, sans explications.
- Ne retourne PAS les titres de lots comme items.
- Retourne chaque ligne produit du tableau comme item séparé.
- "name" doit être vérifiable par copier-coller depuis le texte OCR fourni.
- confidence entre 0 et 1.
- Ajoute "ocrIssues" pour signaler les problèmes OCR détectés.
`;
}
export function safeParseOfferItems(content) {
    try {
        const cleaned = content
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();
        return JSON.parse(cleaned);
    }
    catch (error) {
        console.error("[OFFER ITEMS JSON PARSE ERROR]", error);
        return null;
    }
}
function normalizeItemIdentity(value) {
    return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function areDuplicateOfferItems(a, b) {
    if (a.itemNumber &&
        b.itemNumber &&
        a.itemNumber === b.itemNumber &&
        a.lotNumber === b.lotNumber) {
        const aName = normalizeItemIdentity(a.name);
        const bName = normalizeItemIdentity(b.name);
        if (aName.includes(bName) || bName.includes(aName)) {
            return true;
        }
        const aFamily = detectProductFamily(a.name + " " + (a.description ?? ""));
        const bFamily = detectProductFamily(b.name + " " + (b.description ?? ""));
        return aFamily !== "unknown" && aFamily === bFamily;
    }
    return false;
}
export function dedupeOfferItems(items) {
    const result = [];
    for (const item of items) {
        const existingIndex = result.findIndex((existing) => areDuplicateOfferItems(existing, item));
        if (existingIndex === -1) {
            result.push(item);
            continue;
        }
        const existing = result[existingIndex];
        const existingReqCount = Array.isArray(existing.technicalRequirements)
            ? existing.technicalRequirements.length
            : 0;
        const itemReqCount = Array.isArray(item.technicalRequirements)
            ? item.technicalRequirements.length
            : 0;
        // Keep the richer item
        if (itemReqCount > existingReqCount) {
            result[existingIndex] = {
                ...item,
                itemNumber: existing.itemNumber ?? item.itemNumber,
            };
        }
    }
    return result;
}
//# sourceMappingURL=AiOfferItemsExtraction.js.map