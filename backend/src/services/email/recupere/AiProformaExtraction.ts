import express from "express";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type AiProformaLine = {
  lineNumber: number | null;
  code: string | null;
  designation: string;
  brand: string | null;
  quantity: number | null;
  unitPriceHT: number | null;
  discountPercentage: number | null;
  totalHT: number | null;
  tvaPercentage: number | null;
};

type AiProformaExtraction = {
  documentType: "proforma";
  supplierName: string | null;
  proformaNumber: string | null;
  proformaDate: string | null;
  customerName: string | null;
  totalHT: number | null;
  totalTVA: number | null;
  stampDuty: number | null;
  totalTTC: number | null;
  currency: string | null;
  paymentTerms: string | null;
  validityText: string | null;
  validityDays: number | null;
  lines: AiProformaLine[];
  confidence: number;
};

// ─────────────────────────────────────────────
// PROMPT
// ─────────────────────────────────────────────

export function buildProformaPrompt(text: string): string {
  return `
Tu es un assistant d'extraction de données depuis une facture proforma médicale.

Retourne uniquement un JSON valide, sans markdown.

Texte du document :
${text}

Format obligatoire :
{
  "documentType": "proforma",
  "supplierName": null,
  "proformaNumber": null,
  "proformaDate": null,
  "customerName": null,
  "totalHT": null,
  "totalTVA": null,
  "stampDuty": null,
  "totalTTC": null,
  "currency": "DZD",
  "paymentTerms": null,
  "validityText": null,
  "validityDays": null,
  "lines": [
    {
      "lineNumber": 1,
      "code": null,
      "designation": "",
      "brand": null,
      "quantity": null,
      "unitPriceHT": null,
      "discountPercentage": null,
      "totalHT": null,
      "tvaPercentage": null
    }
  ],
  "confidence": 0
}

Règles générales :
- Retourne uniquement du JSON brut.
- Ne jamais ajouter de markdown.
- Convertis les montants algériens en nombres.
- Exemple : "2 846 020.00" devient 2846020.
- Les dates doivent être au format YYYY-MM-DD.
- Si une donnée est absente, mets null.
- Ne pas inventer les valeurs.
- confidence doit être un nombre entre 0 et 1.
- designation est obligatoire pour chaque ligne.

Règles très importantes pour les tableaux :
- La colonne "N°" ou "No" correspond à lineNumber.
- La colonne "CODE" correspond à code.
- La colonne "DÉSIGNATION" correspond à designation.
- La colonne "QTE", "QTÉ" ou "QUANTITÉ" correspond à quantity.
- La colonne "PU HT" correspond à unitPriceHT.
- La colonne "RIS.%", "REM.%", "REMISE" correspond à discountPercentage.
- La colonne "MONTANT HT" correspond à totalHT.
- La colonne "TVA" correspond à tvaPercentage.
- Ne mets jamais la valeur TVA dans discountPercentage.
- Ne mets jamais la valeur RIS.% dans tvaPercentage.
- Si RIS.% vaut "-" ou est vide, mets discountPercentage à 0.
- Si TVA vaut 19, tvaPercentage doit être 19.
- Si TVA vaut 0, tvaPercentage doit être 0.

Règles de contrôle :
- Si quantity * unitPriceHT = totalHT, garde ces valeurs.
- Si totalHT est clairement écrit dans le tableau, privilégie la valeur écrite.
- Ne confonds pas totalHT et totalTTC.
`;
}
// ─────────────────────────────────────────────
// SAFE PARSE
// ─────────────────────────────────────────────

export function safeParseProforma(
  content: string,
): AiProformaExtraction | null {
  try {
    const cleaned = content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(cleaned) as AiProformaExtraction;
  } catch (error) {
    console.error("JSON parse error:", error);

    return null;
  }
}
