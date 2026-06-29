import fs from "fs";
import { extractProductsFromPDF } from "../services/ocrService";
function cleanString(str) {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-z0-9]/g, " ") // replace punctuation with spaces
        .replace(/\s+/g, " ") // collapse spaces
        .trim();
}
function calculateSimilarity(str1, str2) {
    const words1 = cleanString(str1).split(" ").filter(w => w.length > 1);
    const words2 = cleanString(str2).split(" ").filter(w => w.length > 1);
    if (words1.length === 0 || words2.length === 0)
        return 0;
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    let intersectionCount = 0;
    for (const w of set1) {
        if (set2.has(w))
            intersectionCount++;
    }
    return (2 * intersectionCount) / (set1.size + set2.size);
}
function matchSupplier(referenceItems, supplierItems) {
    const results = [];
    const matchedSupplierItemIds = new Set();
    for (const ref of referenceItems) {
        let bestMatch = null;
        let maxSim = 0;
        for (const sup of supplierItems) {
            if (matchedSupplierItemIds.has(sup.id))
                continue;
            const sim = calculateSimilarity(ref.designation, sup.designation);
            if (sim > maxSim) {
                maxSim = sim;
                bestMatch = sup;
            }
        }
        const threshold = 0.35;
        if (bestMatch && maxSim >= threshold) {
            matchedSupplierItemIds.add(bestMatch.id);
            const compatibility = Math.round(maxSim * 100);
            results.push({
                referenceItem: ref,
                supplierItem: bestMatch,
                compatibility,
                status: compatibility >= 70 ? "matched" : "partial",
                reasons: compatibility >= 70 ? [] : ["Désignation légèrement différente"],
            });
        }
        else {
            results.push({
                referenceItem: ref,
                supplierItem: null,
                compatibility: 0,
                status: "missing",
                reasons: ["Aucun produit correspondant trouvé"],
            });
        }
    }
    return results;
}
/**
 * POST /api/ai/compare-proformas
 * Body: multipart/form-data
 *   - supplierNames[]: string[]
 *   - supplierFiles[]: File[]
 *   - referenceFile?: File
 *   - backendAttachmentId?: string
 *   - backendAttachmentUrl?: string
 */
export async function compareProformas(req, res) {
    try {
        const supplierNames = req.body.supplierNames || [];
        const files = req.files;
        const supplierFiles = (files && files["supplierFiles"]) || [];
        const referenceFile = (files && files["referenceFile"]?.[0]);
        const backendAttachmentUrl = req.body.backendAttachmentUrl;
        console.log("[Compare] Début comparaison pour", supplierNames.length, "fournisseurs");
        // === 1. RÉCUPÉRATION DU CAHIER DE CHARGE ===
        let referenceItems = [];
        if (referenceFile) {
            console.log("[Compare] Cahier de charge uploadé directement:", referenceFile.originalname);
            referenceItems = await extractProductsFromPDF(fs.readFileSync(referenceFile.path), "CAHIER_DE_CHARGE");
        }
        else if (backendAttachmentUrl) {
            console.log("[Compare] Cahier de charge depuis URL:", backendAttachmentUrl);
            try {
                const response = await fetch(backendAttachmentUrl);
                if (!response.ok)
                    throw new Error("Impossible de télécharger le cahier de charge");
                const buffer = Buffer.from(await response.arrayBuffer());
                referenceItems = await extractProductsFromPDF(buffer, "CAHIER_DE_CHARGE");
            }
            catch (err) {
                console.error("[Compare] Erreur téléchargement cahier de charge:", err.message);
                return res
                    .status(400)
                    .json({
                    error: "Impossible de récupérer le cahier de charge depuis l'URL",
                });
            }
        }
        else {
            return res.status(400).json({
                error: "Aucun cahier de charge fourni (referenceFile ou backendAttachmentUrl requis)",
            });
        }
        console.log(`[Compare] ${referenceItems.length} produits extraits du cahier de charge`);
        if (referenceItems.length === 0) {
            return res
                .status(400)
                .json({ error: "Aucun produit trouvé dans le cahier de charge" });
        }
        // === 2. TRAITEMENT DES FOURNISSEURS ===
        const suppliers = [];
        for (let i = 0; i < supplierNames.length; i++) {
            const name = supplierNames[i];
            const file = supplierFiles[i];
            if (!file) {
                console.warn(`[Compare] Fichier manquant pour ${name}`);
                continue;
            }
            console.log(`[Compare] Traitement ${name}: ${file.originalname}`);
            try {
                const pdfBuffer = fs.readFileSync(file.path);
                const supplierItems = await extractProductsFromPDF(pdfBuffer, name);
                console.log(`[Compare] ${name}: ${supplierItems.length} produits extraits`);
                const matches = matchSupplier(referenceItems, supplierItems);
                console.log(`[Compare] ${name}: ${matches.length} matches calculés`);
                suppliers.push({
                    supplierName: name,
                    fileName: file.originalname,
                    matches,
                });
            }
            catch (err) {
                console.error(`[Compare] Erreur traitement ${name}:`, err.message);
                suppliers.push({
                    supplierName: name,
                    fileName: file.originalname,
                    matches: referenceItems.map((ref) => ({
                        referenceItem: ref,
                        supplierItem: null,
                        compatibility: 0,
                        status: "missing",
                        reasons: [`Erreur d'analyse: ${err.message}`],
                    })),
                });
            }
        }
        // === 3. NETTOYAGE DES FICHIERS TEMPORAIRES ===
        supplierFiles.forEach((f) => {
            try {
                fs.unlinkSync(f.path);
            }
            catch (_) { }
        });
        if (referenceFile) {
            try {
                fs.unlinkSync(referenceFile.path);
            }
            catch (_) { }
        }
        // === 4. RÉPONSE ===
        return res.json({ suppliers });
    }
    catch (error) {
        console.error("[Compare] Erreur globale:", error);
        return res.status(500).json({
            error: "Erreur pendant l'analyse OCR/IA",
            details: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
}
//# sourceMappingURL=compareController.js.map