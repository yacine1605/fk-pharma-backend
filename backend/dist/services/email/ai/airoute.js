import { Router } from "express";
import { PDFDocument } from "pdf-lib";
import { buildProformaPrompt, safeParseProforma } from "./AiProformaExtraction";
import { buildConformityPrompt, safeParseConformity, } from "./AiConformityResult";
import { buildAttachmentClassificationPrompt, safeParseAttachmentClassification, } from "./AiAttachmentClassifier";
import { searchOnlineSuppliersAI } from "./web-search";
import { classifyEquipment, generateOptimizedQueries, } from "./openai-supplier-intelligence";
import OpenAI from "openai";
import { z } from "zod";
import { uploadMemory } from "../../../middleware/memoryStorageUpload";
import { zodTextFormat } from "openai/helpers/zod.js";
import { promises as fs } from "fs";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import ExcelJS from "exceljs";
export const aiRoute = Router();
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
const ok = (data) => ({ success: true, data });
const err = (message) => ({ success: false, error: message });
// Stockage temporaire en mémoire (en production : Redis/BullMQ)
const jobs = new Map();
const TMP_DIR = join(process.cwd(), "tmp", "pdf-uploads");
// Nettoyage automatique des vieux jobs (toutes les 10 minutes)
setInterval(() => {
    const now = Date.now();
    const ONE_HOUR = 3600000;
    for (const [jobId, job] of jobs.entries()) {
        if (job.status === "completed" || job.status === "failed") {
            if (now - job.createdAt > ONE_HOUR) {
                fs.unlink(job.filePath).catch(() => { });
                jobs.delete(jobId);
            }
        }
    }
}, 600000);
// Assurer le dossier temporaire existe
fs.mkdir(TMP_DIR, { recursive: true }).catch(() => { });
const tenderExtractionSchema = z.object({
    documentType: z.enum(["TENDER", "CONSULTATION", "INVOICE", "UNKNOWN"]),
    tender: z
        .object({
        title: z.string().nullable(),
        tenderNumber: z.string().nullable(),
        name_organization: z.string().nullable(),
        type_organization: z.string().nullable(),
        ministry: z.string().nullable(),
        direction: z.string().nullable(),
        wilaya: z.string().nullable(),
        address: z.string().nullable(),
        phone: z.string().nullable(),
        email: z.string().nullable(),
        year: z.string().nullable(),
        procedureType: z.enum(["appel_offre", "consultation"]).nullable(),
        depositLocation: z.string().nullable(),
        lots: z.array(z.object({
            number: z.string(),
            object: z.string(),
            detailQuantitatifPages: z.array(z.number()).nullable(),
            dqeItems: z
                .array(z.object({
                itemNumber: z.string().nullable(),
                designation: z.string().nullable(),
                unit: z.string().nullable(),
                quantity: z.string().nullable(),
            }))
                .nullable(),
        })),
    })
        .nullable(),
});
/* ── Proforma Extraction ── */
aiRoute.post("/ai/extract-proforma", async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json(err("Missing OCR text"));
        }
        const prompt = buildProformaPrompt(text);
        const completion = await openai.chat.completions.create({
            model: "gpt-5.4",
            temperature: 0,
            messages: [
                {
                    role: "system",
                    content: "You extract structured medical proforma invoice data.",
                },
                { role: "user", content: prompt },
            ],
        });
        const aiContent = completion.choices[0]?.message?.content || "";
        const parsed = safeParseProforma(aiContent);
        if (!parsed) {
            return res.status(500).json(err("Failed to parse AI JSON response"));
        }
        return res.json(ok(parsed));
    }
    catch (error) {
        console.error(error);
        return res.status(500).json(err("Internal server error"));
    }
});
/* ── Conformity Analysis ── */
aiRoute.post("/ai/analyse-conformity", async (req, res) => {
    try {
        const { requestedItem, proformaText, technicalText } = req.body;
        if (!requestedItem) {
            return res.status(400).json(err("requestedItem is required"));
        }
        const prompt = buildConformityPrompt({
            requestedItem,
            proformaText: proformaText || "",
            technicalText: technicalText || "",
        });
        const completion = await openai.chat.completions.create({
            model: "gpt-5.4",
            temperature: 0,
            messages: [
                {
                    role: "system",
                    content: "You are a biomedical conformity analysis expert.",
                },
                { role: "user", content: prompt },
            ],
        });
        const aiContent = completion.choices[0]?.message?.content || "";
        const parsed = safeParseConformity(aiContent);
        if (!parsed) {
            return res.status(500).json(err("Failed to parse AI response"));
        }
        return res.json(ok(parsed));
    }
    catch (error) {
        console.error(error);
        return res.status(500).json(err("Internal server error"));
    }
});
/* ════════════════════════════════════════════════════════════════════════
   TENDER EXTRACTION — Upload asynchrone avec job queue
   ════════════════════════════════════════════════════════════════════════ */
// ── Étape 1 : Upload du PDF et création du job ──
aiRoute.post("/ai/extract-tender", uploadMemory.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({
                success: false,
                message: "Aucun fichier PDF reçu.",
            });
            return;
        }
        const jobId = uuidv4();
        const filePath = join(TMP_DIR, `${jobId}.pdf`);
        // Sauvegarder le fichier
        await fs.writeFile(filePath, req.file.buffer);
        // Créer le job
        const job = {
            status: "pending",
            progress: 0,
            result: null,
            error: null,
            filePath,
            createdAt: Date.now(),
        };
        jobs.set(jobId, job);
        // Répondre immédiatement avec le jobId
        res.json({
            success: true,
            data: {
                jobId,
                message: "Analyse en file d'attente",
                fileSize: req.file.size,
                fileName: req.file.originalname,
            },
        });
        // Lancer l'analyse en arrière-plan (non-bloquant)
        processTenderExtraction(jobId, req.file.buffer, req.file.originalname).catch((e) => {
            console.error(`[Job ${jobId}] Background processing failed:`, e);
            const j = jobs.get(jobId);
            if (j) {
                j.status = "failed";
                j.error = e instanceof Error ? e.message : "Erreur inconnue";
            }
        });
    }
    catch (error) {
        console.error("extract-tender upload error:", error);
        res.status(500).json({
            success: false,
            message: "Erreur lors de l'upload.",
        });
    }
});
// ── Étape 2 : Vérification du statut du job ──
aiRoute.get("/ai/extract-tender/status/:jobId", async (req, res) => {
    const { jobId } = req.params;
    const job = jobs.get(jobId);
    if (!job) {
        return res.status(404).json({
            success: false,
            message: "Job non trouvé ou expiré.",
        });
    }
    return res.json({
        success: true,
        data: {
            status: job.status,
            progress: job.progress,
            result: job.status === "completed" ? job.result : null,
            error: job.error,
        },
    });
});
// ── Étape 3 : Analyse par chunks (background, non-bloquant) ──
async function processTenderExtraction(jobId, buffer, filename) {
    const job = jobs.get(jobId);
    if (!job) {
        throw new Error("Job not found");
    }
    job.status = "processing";
    try {
        const pdfDoc = await PDFDocument.load(buffer);
        const totalPages = pdfDoc.getPageCount();
        console.log(`[Job ${jobId}] PDF loaded: ${totalPages} pages`);
        // ── Stratégie de chunking intelligente ──
        // Chunk 1 : Pages de garde (infos générales)
        // Chunk 2 : Pages finales (DQE — DÉTAIL QUANTITATIF ET ESTIMATIF)
        // Chunks intermédiaires : si document très long
        const chunks = [];
        // Chunk 1 : Début (page de garde + infos)
        const frontPages = Math.min(3, totalPages);
        chunks.push(Array.from({ length: frontPages }, (_, i) => i));
        // Chunk 2 : Fin (DQE — généralement les 6-8 dernières pages)
        const backPageCount = Math.min(8, Math.floor(totalPages * 0.3));
        const backStart = Math.max(frontPages, totalPages - backPageCount);
        const backPages = Array.from({ length: totalPages - backStart }, (_, i) => backStart + i);
        if (backPages.length > 0) {
            chunks.push(backPages);
        }
        // Chunks intermédiaires : milieu du document (par lots de 5 pages)
        const middleStart = frontPages;
        const middleEnd = backStart;
        const CHUNK_SIZE = 5;
        if (middleEnd > middleStart) {
            for (let i = middleStart; i < middleEnd; i += CHUNK_SIZE) {
                const end = Math.min(i + CHUNK_SIZE, middleEnd);
                chunks.push(Array.from({ length: end - i }, (_, j) => i + j));
            }
        }
        console.log(`[Job ${jobId}] Chunks: ${chunks.length} chunks`);
        // ── Résultat accumulé ──
        let mergedResult = {
            documentType: "TENDER",
            tender: {
                title: null,
                tenderNumber: null,
                name_organization: null,
                type_organization: null,
                ministry: null,
                direction: null,
                wilaya: null,
                address: null,
                phone: null,
                email: null,
                year: null,
                procedureType: null,
                depositLocation: null,
                lots: [],
            },
        };
        // ── Analyser chaque chunk ──
        for (let i = 0; i < chunks.length; i++) {
            const chunkIndices = chunks[i];
            job.progress = Math.round(((i + 0.5) / chunks.length) * 100);
            console.log(`[Job ${jobId}] Processing chunk ${i + 1}/${chunks.length}: pages ${chunkIndices
                .map((p) => p + 1)
                .join(", ")}`);
            // Créer un mini-PDF pour ce chunk envoyé à l'IA
            // Note : on garde le PDF ici parce que l'IA analyse le contenu original.
            // Le résultat final généré pour chaque lot sera un fichier Excel.
            const chunkPdf = await PDFDocument.create();
            const copiedPages = await chunkPdf.copyPages(pdfDoc, chunkIndices);
            copiedPages.forEach((p) => chunkPdf.addPage(p));
            const chunkBytes = await chunkPdf.save();
            const chunkBase64 = Buffer.from(chunkBytes).toString("base64");
            // Construire le prompt contextuel pour ce chunk
            const isFirstChunk = i === 0;
            const isLastChunk = i === chunks.length - 1;
            const prompt = buildChunkPrompt(isFirstChunk, isLastChunk, chunkIndices, totalPages);
            // Appel GPT pour ce chunk
            const response = await openai.responses.parse({
                model: "gpt-5.4-mini-2026-03-17",
                input: [
                    {
                        role: "user",
                        content: [
                            { type: "input_text", text: prompt },
                            {
                                type: "input_file",
                                filename: `${filename}_chunk${i + 1}.pdf`,
                                file_data: `data:application/pdf;base64,${chunkBase64}`,
                            },
                        ],
                    },
                ],
                text: {
                    format: zodTextFormat(tenderExtractionSchema, `tender_extraction_chunk_${i}`),
                },
            });
            const chunkResult = response.output_parsed;
            if (chunkResult) {
                mergedResult = mergeChunkResults(mergedResult, chunkResult);
            }
            // Rate limiting : pause entre les chunks
            if (i < chunks.length - 1) {
                await new Promise((r) => setTimeout(r, 1200));
            }
            // Mise à jour progression
            job.progress = Math.round(((i + 1) / chunks.length) * 100);
        }
        // ── Post-traitement : nettoyage des objets de lots et génération Excel ──
        if (mergedResult.tender?.lots?.length > 0) {
            console.log(`[Job ${jobId}] Post-processing: ${mergedResult.tender.lots.length} lots`);
            // Nettoyer les objets de lots (supprimer texte système/technique)
            const cleanedLots = mergedResult.tender.lots.map((lot) => ({
                ...lot,
                object: cleanLotObject(lot.object),
            }));
            mergedResult.tender.lots = cleanedLots;
            // Générer les fichiers Excel DQE par lot
            console.log(`[Job ${jobId}] Generating Excel files: ${cleanedLots.length} lots`);
            const lotsWithExcel = await Promise.all(cleanedLots.map(async (lot) => {
                const excelBase64 = await generateLotExcelBase64({
                    lot,
                    tender: mergedResult.tender,
                });
                return {
                    ...lot,
                    excelBase64,
                    excelFileName: `lot_${sanitizeFileName(lot.number || "unknown")}_dqe.xlsx`,
                };
            }));
            mergedResult.tender.lots = lotsWithExcel;
        }
        // ── Finaliser le job ──
        job.status = "completed";
        job.progress = 100;
        job.result = mergedResult;
        console.log(`[Job ${jobId}] Completed successfully`);
        // Nettoyage différé (1 heure)
        setTimeout(() => {
            fs.unlink(job.filePath).catch(() => { });
            jobs.delete(jobId);
        }, 3600000);
    }
    catch (error) {
        console.error(`[Job ${jobId}] Failed:`, error);
        job.status = "failed";
        job.error = error instanceof Error ? error.message : "Erreur inconnue";
        // Nettoyage immédiat en cas d'erreur
        fs.unlink(job.filePath).catch(() => { });
    }
}
/* ── Post-traitement : nettoyer l'objet du lot ──
   Supprime les textes système/techniques qui polluent l'extraction AI
   Ex: "System évaluation technique des lots 01/02/03/04/05/06" → ""
*/
function cleanLotObject(object) {
    if (!object)
        return "";
    const text = object.trim();
    // Patterns de texte système/technique à rejeter
    const systemPatterns = [
        /system\s+évaluation\s+technique/i,
        /évaluation\s+technique\s+des\s+lots/i,
        /tableau\s+récapitulatif/i,
        /récapitulatif\s+des\s+lots/i,
        /synthèse\s+des\s+lots/i,
        /liste\s+des\s+lots/i,
        /détail\s+quantitatif\s+et\s+estimatif/i,
        /d\.?q\.?e\.?/i,
        /cahier\s+des\s+charges/i,
        /appel\s+d'offres/i,
        /consultation/i,
        /^(lot\s+n?°?\s*\d+)$/i, // Juste "LOT N° 01" sans description
        /^\d+\s*\/\s*\d+$/, // Juste "01/02/03"
        /^\d+\s*[-,;\s]+\s*\d+/, // Séquences de numéros
    ];
    for (const pattern of systemPatterns) {
        if (pattern.test(text)) {
            // Si le texte ENTIER correspond au pattern, c'est du texte système
            // On retourne une chaîne vide pour forcer la re-extraction ou l'ignorer
            return "";
        }
    }
    // Nettoyer les préfixes "LOT N° X :" ou "LOT X -"
    return text
        .replace(/^lot\s+n?°?\s*\d+\s*[:\-–]\s*/i, "")
        .replace(/^lot\s+\d+\s*[:\-–]\s*/i, "")
        .trim();
}
// ── Prompt contextuel par chunk ──
function buildChunkPrompt(isFirst, isLast, indices, total) {
    let context = "";
    if (isFirst) {
        context = `Ceci est le DÉBUT du document (pages ${indices
            .map((i) => i + 1)
            .join(", ")}/${total}).
Concentre-toi EXCLUSIVEMENT sur :
- Page de garde : titre, numéro d'appel d'offres, nom de l'organisation
- Coordonnées : adresse, téléphone, email, wilaya
- Type de procédure, ministère, direction, lieu de dépôt
- Année du marché

Ne cherche PAS les lots ici sauf s'ils sont clairement visibles sur ces pages.`;
    }
    else if (isLast) {
        context = `Ceci est la FIN du document (pages ${indices
            .map((i) => i + 1)
            .join(", ")}/${total}).
Concentre-toi EXCLUSIVEMENT sur :
- Les sections "DETAIL QUANTITATIF ET ESTIMATIF" pour CHAQUE lot
- Pour chaque lot : numéro (ex: "01"), objet/désignation (ex: "CONSOMMABLES D'HEMODIALYSE")
- Les lignes du tableau DQE pour chaque lot :
  - itemNumber : numéro ou référence de ligne
  - designation : désignation/prestation/article
  - unit : unité
  - quantity : quantité
- Les numéros de page EXACTS (1-indexed) où se trouve chaque section DQE
- Si une page récapitulative "RECAPITULATIVE" existe, utilise-la pour vérifier tous les lots

C'est la section la plus importante pour les lots et les tableaux DQE.`;
    }
    else {
        context = `Ceci est le MILIEU du document (pages ${indices
            .map((i) => i + 1)
            .join(", ")}/${total}).
Cherche :
- Des informations complémentaires sur les lots (numéros, objets)
- Des détails sur les spécifications techniques
- Des tableaux DQE éventuels
- Tout ce qui pourrait manquer des chunks précédents`;
    }
    return `Tu es un assistant spécialisé dans l'analyse des cahiers des charges et appels d'offres algériens (marchés publics).

${context}

Règles strictes pour le champ "object" (OBJET DU LOT) :
- L'objet doit être la DÉSIGNATION DESCRIPTIVE du lot, ex: "CONSOMMABLES D'HEMODIALYSE", "EQUIPEMENTS DE RADIOLOGIE", "MOBILIER MEDICAL"
- NE JAMAIS mettre de texte système/procédural comme : "System évaluation technique", "Tableau récapitulatif", "Détail quantitatif et estimatif", "Cahier des charges"
- NE JAMAIS mettre juste une liste de numéros comme "01/02/03/04/05/06"
- Si l'objet n'est pas clairement identifiable, utiliser null ou ""
- Nettoyer les préfixes "LOT N° X" ou "LOT X -" : ne garder que la description

Règles strictes pour les autres champs :
- Ne JAMAIS inventer de valeur → utiliser null si absent
- Extraire TOUS les lots, même s'il y en a plus de 6
- Conserver la CASSE d'origine (pas tout en majuscules)
- "number" = numéro nettoyé (ex: "01", "02") sans "LOT N°"
- "object" = désignation nettoyée sans préfixe lot
- "detailQuantitatifPages" = numéros de page 1-indexed de la DQE de CE lot
- "dqeItems" = lignes du tableau DQE si visibles, sinon null
- Pour chaque ligne DQE :
  - "itemNumber" = numéro de poste/article si présent, sinon null
  - "designation" = désignation exacte de l'article/prestation
  - "unit" = unité si présente, sinon null
  - "quantity" = quantité si présente, sinon null`;
}
// ── Fusion intelligente des résultats par chunk ──
function mergeChunkResults(acc, chunk) {
    if (!chunk || !chunk.tender) {
        return acc;
    }
    const merged = JSON.parse(JSON.stringify(acc));
    const t = chunk.tender;
    // Merge champs simples (priorité au non-null)
    const fields = [
        "title",
        "tenderNumber",
        "name_organization",
        "type_organization",
        "ministry",
        "direction",
        "wilaya",
        "address",
        "phone",
        "email",
        "year",
        "procedureType",
        "depositLocation",
    ];
    for (const field of fields) {
        if (t[field] && !merged.tender[field]) {
            merged.tender[field] = t[field];
        }
    }
    // Merge lots : union + déduplication par number
    if (t.lots?.length > 0) {
        const existingMap = new Map(merged.tender.lots.map((l) => [l.number, l]));
        for (const lot of t.lots) {
            const existing = existingMap.get(lot.number);
            if (!existing) {
                const normalizedLot = {
                    ...lot,
                    detailQuantitatifPages: lot.detailQuantitatifPages || [],
                    dqeItems: lot.dqeItems || null,
                };
                existingMap.set(lot.number, normalizedLot);
                merged.tender.lots.push(normalizedLot);
            }
            else {
                if (lot.detailQuantitatifPages?.length > 0) {
                    const allPages = [
                        ...(existing.detailQuantitatifPages || []),
                        ...lot.detailQuantitatifPages,
                    ];
                    existing.detailQuantitatifPages = [...new Set(allPages)].sort((a, b) => a - b);
                }
                // FIX: Ne pas préférer le texte le plus long pour l'objet
                // Le texte le plus long est souvent du texte système pollué
                // On préfère le texte qui ressemble le plus à une vraie désignation
                if (lot.object && lot.object.trim()) {
                    const existingObj = existing.object || "";
                    const newObj = lot.object.trim();
                    // Si l'existant est vide ou texte système, on prend le nouveau
                    if (!existingObj || isSystemText(existingObj)) {
                        existing.object = newObj;
                    }
                    // Si le nouveau est plus court et l'existant est long (système),
                    // on prend le nouveau (probablement la vraie description)
                    else if (newObj.length < existingObj.length &&
                        isSystemText(existingObj)) {
                        existing.object = newObj;
                    }
                    // Si les deux sont des vrais textes, on garde le plus descriptif
                    else if (!isSystemText(newObj) && !isSystemText(existingObj)) {
                        // Garder celui qui a le meilleur "score" de description
                        existing.object = chooseBetterDescription(existingObj, newObj);
                    }
                    // Sinon, on garde l'existant s'il n'est pas du texte système
                }
                if (Array.isArray(lot.dqeItems) && lot.dqeItems.length > 0) {
                    const existingItems = Array.isArray(existing.dqeItems)
                        ? existing.dqeItems
                        : [];
                    existing.dqeItems = mergeDqeItems(existingItems, lot.dqeItems);
                }
            }
        }
    }
    return merged;
}
/* ── Détecte si un texte est du texte système/procédural ── */
function isSystemText(text) {
    if (!text)
        return false;
    const lower = text.toLowerCase();
    const systemKeywords = [
        "system",
        "évaluation technique",
        "tableau récapitulatif",
        "récapitulatif",
        "cahier des charges",
        "appel d'offres",
        "détail quantitatif",
        "d.q.e",
        "dqe",
        "consultation",
        "synthèse",
        "liste des lots",
    ];
    return systemKeywords.some((kw) => lower.includes(kw));
}
/* ── Choisit la meilleure description entre deux textes ── */
function chooseBetterDescription(a, b) {
    // Préférer le texte qui contient des mots descriptifs réels
    // et pas juste des numéros ou des références
    const aScore = descriptionScore(a);
    const bScore = descriptionScore(b);
    return aScore >= bScore ? a : b;
}
function descriptionScore(text) {
    if (!text)
        return 0;
    let score = text.length; // Longueur de base
    // Pénaliser les caractères spéciaux excessifs
    const specialChars = (text.match(/[^\w\s\-']/g) || []).length;
    score -= specialChars * 2;
    // Pénaliser les séquences de numéros
    const numberSequences = (text.match(/\d+\s*\/\s*\d+/g) || []).length;
    score -= numberSequences * 10;
    // Bonus pour les mots descriptifs médicaux/techniques
    const descriptiveWords = [
        "equipement",
        "consommable",
        "materiel",
        "appareil",
        "dispositif",
        "laboratoire",
        "radiologie",
        "chirurgie",
        "reanimation",
        "hemodialyse",
        "scanner",
        "irm",
        "echographie",
        "moniteur",
        "respirateur",
        "pompe",
    ];
    const lower = text.toLowerCase();
    for (const word of descriptiveWords) {
        if (lower.includes(word))
            score += 5;
    }
    return Math.max(0, score);
}
function mergeDqeItems(existingItems, newItems) {
    const map = new Map();
    for (const item of existingItems) {
        const key = buildDqeItemKey(item);
        map.set(key, item);
    }
    for (const item of newItems) {
        const key = buildDqeItemKey(item);
        if (!map.has(key)) {
            map.set(key, item);
            continue;
        }
        const existing = map.get(key);
        map.set(key, {
            itemNumber: existing.itemNumber || item.itemNumber || null,
            designation: chooseLonger(existing.designation, item.designation),
            unit: existing.unit || item.unit || null,
            quantity: existing.quantity || item.quantity || null,
        });
    }
    return Array.from(map.values());
}
function buildDqeItemKey(item) {
    const itemNumber = normalizeKey(item.itemNumber);
    const designation = normalizeKey(item.designation);
    return `${itemNumber}::${designation}`;
}
function normalizeKey(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
function chooseLonger(a, b) {
    const aText = typeof a === "string" ? a : "";
    const bText = typeof b === "string" ? b : "";
    if (!aText && !bText) {
        return null;
    }
    return bText.length > aText.length ? bText : aText;
}
async function generateLotExcelBase64({ lot, tender, }) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "AI Tender Extraction";
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet("DQE");
    worksheet.columns = [
        { header: "Champ", key: "field", width: 30 },
        { header: "Valeur", key: "value", width: 80 },
    ];
    worksheet.addRow({
        field: "Titre",
        value: tender.title || "",
    });
    worksheet.addRow({
        field: "Numéro appel d'offres",
        value: tender.tenderNumber || "",
    });
    worksheet.addRow({
        field: "Organisme",
        value: tender.name_organization || "",
    });
    worksheet.addRow({
        field: "Type organisme",
        value: tender.type_organization || "",
    });
    worksheet.addRow({
        field: "Ministère",
        value: tender.ministry || "",
    });
    worksheet.addRow({
        field: "Direction",
        value: tender.direction || "",
    });
    worksheet.addRow({
        field: "Wilaya",
        value: tender.wilaya || "",
    });
    worksheet.addRow({
        field: "Année",
        value: tender.year || "",
    });
    worksheet.addRow({
        field: "Lot",
        value: lot.number || "",
    });
    worksheet.addRow({
        field: "Objet du lot",
        value: lot.object || "",
    });
    worksheet.addRow({
        field: "Pages DQE",
        value: Array.isArray(lot.detailQuantitatifPages)
            ? lot.detailQuantitatifPages.join(", ")
            : "",
    });
    const metadataHeader = worksheet.getRow(1);
    metadataHeader.font = { bold: true };
    metadataHeader.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEFEFEF" },
    };
    worksheet.addRow([]);
    const tableHeaderRowNumber = worksheet.rowCount + 1;
    worksheet.addRow(["N°", "Désignation", "Unité", "Quantité"]);
    const tableHeaderRow = worksheet.getRow(tableHeaderRowNumber);
    tableHeaderRow.font = { bold: true };
    tableHeaderRow.alignment = {
        vertical: "middle",
        horizontal: "center",
    };
    tableHeaderRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9EAF7" },
    };
    const dqeItems = Array.isArray(lot.dqeItems) ? lot.dqeItems : [];
    if (dqeItems.length === 0) {
        worksheet.addRow(["", "Aucune ligne DQE extraite", "", ""]);
    }
    else {
        for (const item of dqeItems) {
            worksheet.addRow([
                item.itemNumber || "",
                item.designation || "",
                item.unit || "",
                item.quantity || "",
            ]);
        }
    }
    worksheet.columns = [
        { width: 18 },
        { width: 80 },
        { width: 18 },
        { width: 18 },
    ];
    worksheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.alignment = {
                vertical: "top",
                wrapText: true,
            };
            cell.border = {
                top: { style: "thin", color: { argb: "FFD9D9D9" } },
                left: { style: "thin", color: { argb: "FFD9D9D9" } },
                bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
                right: { style: "thin", color: { argb: "FFD9D9D9" } },
            };
        });
    });
    worksheet.views = [{ state: "frozen", ySplit: tableHeaderRowNumber }];
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer).toString("base64");
}
function sanitizeFileName(value) {
    return value
        .replace(/[<>:"/\|?*-]/g, "_")
        .replace(/\s+/g, "_")
        .slice(0, 80);
}
/* ════════════════════════════════════════════════════════════════════════
   ROUTES EXISTANTES
   ════════════════════════════════════════════════════════════════════════ */
/* ── Attachment Classification ── */
aiRoute.post("/ai/classify-attachment", async (req, res) => {
    try {
        const { fileName, mimeType, extractedText } = req.body;
        if (!fileName) {
            return res.status(400).json(err("fileName is required"));
        }
        const prompt = buildAttachmentClassificationPrompt({
            fileName,
            mimeType,
            extractedText,
        });
        const completion = await openai.chat.completions.create({
            model: "gpt-5.4-mini",
            temperature: 0,
            messages: [
                {
                    role: "system",
                    content: "You are an expert supplier document classifier.",
                },
                { role: "user", content: prompt },
            ],
        });
        const aiContent = completion.choices[0]?.message?.content || "";
        const parsed = safeParseAttachmentClassification(aiContent);
        if (!parsed) {
            return res.status(500).json(err("Failed to parse AI response"));
        }
        return res.json(ok(parsed));
    }
    catch (error) {
        console.error(error);
        return res.status(500).json(err("Internal server error"));
    }
});
/* ── Supplier AI Search ── */
aiRoute.post("/suppliers/search-ai", async (req, res) => {
    try {
        const { itemName, maxResults } = req.body;
        if (!itemName) {
            return res.status(400).json(err("itemName is required"));
        }
        const result = await searchOnlineSuppliersAI(itemName, maxResults || 8);
        return res.json(ok(result));
    }
    catch (error) {
        console.error("[SUPPLIERS SEARCH AI]", error);
        return res.status(500).json(err("Erreur recherche fournisseurs IA"));
    }
});
/* ── Equipment Classification ── */
aiRoute.post("/equipment/classify", async (req, res) => {
    try {
        const { description } = req.body;
        if (!description) {
            return res.status(400).json(err("description is required"));
        }
        const result = await classifyEquipment(description);
        return res.json(ok(result));
    }
    catch (error) {
        console.error("[EQUIPMENT CLASSIFY]", error);
        return res.status(500).json(err("Erreur classification équipement"));
    }
});
/* ── Optimized Search Queries ── */
aiRoute.post("/equipment/search-queries", async (req, res) => {
    try {
        const { equipmentName, categoryHint, count } = req.body;
        if (!equipmentName) {
            return res.status(400).json(err("equipmentName is required"));
        }
        const result = await generateOptimizedQueries(equipmentName, categoryHint, count || 4);
        return res.json(ok(result));
    }
    catch (error) {
        console.error("[EQUIPMENT QUERIES]", error);
        return res.status(500).json(err("Erreur génération requêtes"));
    }
});
//# sourceMappingURL=airoute.js.map