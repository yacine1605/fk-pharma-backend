const pdfParse = require("pdf-parse");
const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
function toNumber(val) {
    if (val == null)
        return null;
    const n = parseFloat(String(val).replace(/\s/g, "").replace(/,/g, "."));
    return isNaN(n) ? null : n;
}
async function extractWithMistralOCR(pdfBuffer) {
    try {
        const { Mistral } = require("@mistralai/mistralai");
        const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
        const uploadedFile = await client.files.upload({
            file: { fileName: "proforma.pdf", content: pdfBuffer },
            purpose: "ocr",
        });
        const signedUrl = await client.files.getSignedUrl({ fileId: uploadedFile.id });
        const ocrResponse = await client.ocr.process({
            model: "mistral-ocr-latest",
            document: { type: "document_url", documentUrl: signedUrl.url },
        });
        return ocrResponse.pages
            .map((p) => p.markdown || p.text)
            .join("\n\n");
    }
    catch (err) {
        if (err.code === "MODULE_NOT_FOUND") {
            throw new Error("Module @mistralai/mistralai non installé. Lancez: npm install @mistralai/mistralai");
        }
        throw err;
    }
}
async function structureWithAI(rawText, supplierName) {
    const systemPrompt = `Tu es un assistant d'extraction de données pour des proformas fournisseurs.
Tu dois analyser le texte brut extrait d'un PDF et retourner UNIQUEMENT un objet JSON valide.

Règles:
1. Identifie tous les produits listés dans les tableaux
2. Pour chaque produit, extrais:
   - designation (string, obligatoire): nom complet du produit
   - quantity (number|null): quantité proposée
   - unit (string|null): unité (boîte, pièce, flacon, tube, etc.)
   - unitPrice (number|null): prix unitaire HT
   - totalPrice (number|null): prix total HT
   - page (number|null): numéro de page si identifiable
3. Si une information est absente, mets null
4. Ne retourne que le JSON, sans markdown, sans explication

Format attendu:
{
  "products": [
    { "designation": "...", "quantity": 10, "unit": "boîte", "unitPrice": 1500, "totalPrice": 15000, "page": 1 }
  ]
}`;
    const userPrompt = `Texte brut extrait du proforma de "${supplierName}":

---
${rawText.substring(0, 12000)}
---

Extrais tous les produits en JSON.`;
    const response = await openai.chat.completions.create({
        model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.05,
        max_tokens: 4000,
    });
    const content = response.choices[0].message.content;
    let parsed;
    try {
        parsed = JSON.parse(content);
    }
    catch (e) {
        console.error("[OCR] Réponse IA non valide:", content.substring(0, 500));
        throw new Error("La réponse de l'IA n'est pas un JSON valide");
    }
    const products = Array.isArray(parsed.products)
        ? parsed.products
        : Array.isArray(parsed)
            ? parsed
            : [];
    return products.map((p, idx) => ({
        id: `supp-${supplierName}-${idx}`,
        designation: p.designation || p.name || p.nom || "Produit inconnu",
        quantity: toNumber(p.quantity),
        unit: p.unit || p.unite || p.unité || null,
        unitPrice: toNumber(p.unitPrice || p.pu || p.prix_unitaire),
        totalPrice: toNumber(p.totalPrice || p.pt || p.total || p.prix_total),
        confidence: 85,
        page: toNumber(p.page) || 1,
    }));
}
export async function extractProductsFromPDF(pdfBuffer, supplierName) {
    let rawText = "";
    try {
        const parsed = await pdfParse(pdfBuffer);
        rawText = parsed.text || "";
    }
    catch (err) {
        console.warn(`[OCR] pdf-parse a échoué pour ${supplierName}:`, err.message);
    }
    if (rawText.trim().length < 100) {
        console.warn(`[OCR] ${supplierName}: PDF probablement scanné ou image (texte=${rawText.trim().length} chars).`);
        if (process.env.MISTRAL_API_KEY) {
            try {
                rawText = await extractWithMistralOCR(pdfBuffer);
            }
            catch (mistralErr) {
                console.error("[OCR] Mistral OCR a échoué:", mistralErr.message);
            }
        }
        else {
            console.warn("[OCR] MISTRAL_API_KEY non configuré. Pour les scans, installez et configurez Mistral OCR.");
        }
    }
    if (!rawText.trim()) {
        throw new Error(`Aucun texte extractible dans le PDF de ${supplierName}. Le fichier est peut-être un scan sans couche OCR.`);
    }
    return structureWithAI(rawText, supplierName);
}
//# sourceMappingURL=ocrService.js.map