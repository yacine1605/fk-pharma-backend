import path from "path";
import OpenAI from "openai";
import { eq } from "drizzle-orm";

import { db } from "../../db/drizzle";
import {
  tenderDocuments,
  offerItems,
  offers,
  type TenderDocument,
} from "../../db/schema";
import {
  extractTextSmart,
  extractTextFromDocx,
  extractTextFromExcel,
} from "../email/ai/exctraction";
import { ocrImage } from "../email/ai/image-ocr";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = "gpt-4o";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ExtractedProduct = {
  itemNumber: number;
  code?: string;
  designation: string;
  quantity: number;
  unite?: string;
  specifications?: string[];
};

export type ExtractedDeadlines = {
  dateLimiteDepot?: string;
  dateLimiteSoumission?: string;
  dateOuverturePlis?: string;
  autresDelais?: { label: string; date: string }[];
};

export type TenderExtractionResult = {
  documentId: string;
  offerId: string;
  products: ExtractedProduct[];
  deadlines: ExtractedDeadlines;
  administrativeDocuments: string[];
  prescriptionsTechniques: string;
  consultationNumber?: string;
  wilaya?: string;
  etablissement?: string;
  objet?: string;
  confidence: number;
  itemsCreated: number;
  rawText: string;
};

// ─── Main Pipeline ────────────────────────────────────────────────────────────

export async function processTenderDocument(
  documentId: string,
): Promise<TenderExtractionResult> {
  // 1. Mark as processing
  const [doc] = await db
    .update(tenderDocuments)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(tenderDocuments.id, documentId))
    .returning();

  if (!doc) {
    throw new Error(`Document introuvable: ${documentId}`);
  }

  try {
    // 2. Extract raw text from the file
    const { text, ocrRequired, ocrDone, pages } = await extractRawText(doc);

    // 3. AI extraction with specialized French tender prompt
    const extracted = await extractWithAI(text, doc.fileName);

    // 4. Save results to tenderDocuments
    await db
      .update(tenderDocuments)
      .set({
        status: "extracted",
        extractedText: text,
        extractedJson: {
          products: extracted.products,
          deadlines: extracted.deadlines,
          administrativeDocuments: extracted.administrativeDocuments,
          prescriptionsTechniques: extracted.prescriptionsTechniques,
          consultationNumber: extracted.consultationNumber,
          wilaya: extracted.wilaya,
          etablissement: extracted.etablissement,
          objet: extracted.objet,
          confidence: extracted.confidence,
        },
        pageCount: pages,
        ocrRequired,
        ocrDone,
        confidence: extracted.confidence,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(tenderDocuments.id, documentId));

    // 5. Auto-populate offerItems from extracted products (non-destructive: only if no items exist)
    const itemsCreated = await populateOfferItems(
      doc.offerId,
      extracted.products,
      doc.uploadedBy ?? undefined,
    );

    // 6. Auto-update offer header fields if found
    await updateOfferMetadata(doc.offerId, extracted);

    return {
      documentId,
      offerId: doc.offerId,
      products: extracted.products,
      deadlines: extracted.deadlines,
      administrativeDocuments: extracted.administrativeDocuments,
      prescriptionsTechniques: extracted.prescriptionsTechniques,
      consultationNumber: extracted.consultationNumber,
      wilaya: extracted.wilaya,
      etablissement: extracted.etablissement,
      objet: extracted.objet,
      confidence: extracted.confidence,
      itemsCreated,
      rawText: text,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur inconnue";

    await db
      .update(tenderDocuments)
      .set({ status: "failed", errorMessage: message, updatedAt: new Date() })
      .where(eq(tenderDocuments.id, documentId));

    throw error;
  }
}

// ─── Text extraction ──────────────────────────────────────────────────────────

async function extractRawText(doc: TenderDocument): Promise<{
  text: string;
  ocrRequired: boolean;
  ocrDone: boolean;
  pages?: number;
}> {
  const ext = path.extname(doc.fileName).toLowerCase();

  if (ext === ".pdf") {
    const result = await extractTextSmart(doc.filePath);
    return {
      text: result.text,
      ocrRequired: result.ocrRequired,
      ocrDone: result.method === "ocr",
      pages: result.pages,
    };
  }

  if (ext === ".docx" || ext === ".doc") {
    const text = await extractTextFromDocx(doc.filePath);
    return { text, ocrRequired: false, ocrDone: false };
  }

  if (ext === ".xlsx" || ext === ".xls") {
    const text = await extractTextFromExcel(doc.filePath);
    return { text, ocrRequired: false, ocrDone: false };
  }

  if ([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"].includes(ext)) {
    const text = await ocrImage(doc.filePath);
    return { text, ocrRequired: true, ocrDone: true };
  }

  throw new Error(`Format de fichier non supporté: ${ext}`);
}

// ─── AI Extraction ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un expert en analyse de documents d'appels d'offres publics algériens (marchés publics).
Tu extrais les informations structurées d'un cahier des charges ou d'un appel d'offres en français ou en arabe.
Tu réponds UNIQUEMENT avec un JSON valide, sans markdown, sans explication.`;

function buildExtractionPrompt(text: string, fileName: string): string {
  const truncated = text.slice(0, 12000);
  return `Analyse ce document d'appel d'offres: "${fileName}"

Extrais et retourne ce JSON exact (toutes les clés sont obligatoires, utilise null si information non trouvée):

{
  "objet": "objet de l'appel d'offres",
  "consultationNumber": "numéro de consultation ou appel d'offres",
  "wilaya": "wilaya ou région",
  "etablissement": "nom de l'établissement ou entité",
  "products": [
    {
      "itemNumber": 1,
      "code": "code article ou null",
      "designation": "désignation complète du produit",
      "quantity": 10,
      "unite": "unité (pcs, boîtes, kg, etc.)",
      "specifications": ["spec 1", "spec 2"]
    }
  ],
  "deadlines": {
    "dateLimiteDepot": "YYYY-MM-DD ou null",
    "dateLimiteSoumission": "YYYY-MM-DD ou null",
    "dateOuverturePlis": "YYYY-MM-DD ou null",
    "autresDelais": [{"label": "nom du délai", "date": "YYYY-MM-DD"}]
  },
  "administrativeDocuments": [
    "liste des documents administratifs requis"
  ],
  "prescriptionsTechniques": "résumé des prescriptions et exigences techniques",
  "confidence": 0.0
}

Règles:
- products: TOUS les articles/produits listés dans le document, avec quantités
- confidence: entre 0.0 et 1.0, représente ta confiance dans l'extraction
- dates: format ISO YYYY-MM-DD, ou null si non trouvée
- Si le document est en arabe, traduis les champs en français
- Ne jamais inventer de données non présentes dans le document

DOCUMENT:
${truncated}`;
}

async function extractWithAI(text: string, fileName: string): Promise<{
  products: ExtractedProduct[];
  deadlines: ExtractedDeadlines;
  administrativeDocuments: string[];
  prescriptionsTechniques: string;
  consultationNumber?: string;
  wilaya?: string;
  etablissement?: string;
  objet?: string;
  confidence: number;
}> {
  if (!text.trim() || text.trim().length < 50) {
    return {
      products: [],
      deadlines: {},
      administrativeDocuments: [],
      prescriptionsTechniques: "",
      confidence: 0,
    };
  }

  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildExtractionPrompt(text, fileName) },
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";

  try {
    const parsed = JSON.parse(raw);
    return {
      products: normalizeProducts(parsed.products ?? []),
      deadlines: parsed.deadlines ?? {},
      administrativeDocuments: Array.isArray(parsed.administrativeDocuments)
        ? parsed.administrativeDocuments.filter((d: any) => typeof d === "string")
        : [],
      prescriptionsTechniques: parsed.prescriptionsTechniques ?? "",
      consultationNumber: parsed.consultationNumber ?? undefined,
      wilaya: parsed.wilaya ?? undefined,
      etablissement: parsed.etablissement ?? undefined,
      objet: parsed.objet ?? undefined,
      confidence: clamp(Number(parsed.confidence ?? 0.5), 0, 1),
    };
  } catch {
    console.error("[TENDER-EXTRACTION] Failed to parse AI response:", raw.slice(0, 500));
    return {
      products: [],
      deadlines: {},
      administrativeDocuments: [],
      prescriptionsTechniques: "",
      confidence: 0,
    };
  }
}

function normalizeProducts(rawProducts: any[]): ExtractedProduct[] {
  if (!Array.isArray(rawProducts)) return [];

  return rawProducts
    .filter((p) => p && typeof p.designation === "string" && p.designation.trim())
    .map((p, index) => ({
      itemNumber: Number(p.itemNumber ?? index + 1),
      code: p.code ?? undefined,
      designation: String(p.designation).trim(),
      quantity: Math.max(1, Number(p.quantity ?? 1)),
      unite: p.unite ?? undefined,
      specifications: Array.isArray(p.specifications)
        ? p.specifications.filter((s: any) => typeof s === "string")
        : [],
    }));
}

// ─── Populate offerItems ──────────────────────────────────────────────────────

async function populateOfferItems(
  offerId: string,
  products: ExtractedProduct[],
  userId?: string,
): Promise<number> {
  if (products.length === 0) return 0;

  // Check if offerItems already exist — don't overwrite user edits
  const existingItems = await db.query.offerItems.findMany({
    where: eq(offerItems.offerId, offerId),
  });

  if (existingItems.length > 0) {
    console.log(
      `[TENDER-EXTRACTION] ${existingItems.length} articles déjà présents — extraction stockée sans écrasement.`,
    );
    return 0;
  }

  // Insert new items
  const newItems = products.map((p) => ({
    offerId,
    itemNumber: p.itemNumber,
    code: p.code ?? null,
    name: p.designation,
    description: p.unite ? `Unité: ${p.unite}` : null,
    requestedQuantity: p.quantity,
    technicalRequirements: (p.specifications ?? []).map((spec, i) => ({
      label: spec,
      required: true,
      weight: Math.round(100 / Math.max(1, (p.specifications ?? []).length)),
      acceptedValues: undefined,
    })),
    minConformityPercentage: 70,
  }));

  if (newItems.length === 0) return 0;

  await db.insert(offerItems).values(newItems);

  console.log(
    `[TENDER-EXTRACTION] ${newItems.length} articles créés pour l'offre ${offerId}`,
  );
  return newItems.length;
}

// ─── Update Offer Metadata ────────────────────────────────────────────────────

async function updateOfferMetadata(
  offerId: string,
  extracted: {
    consultationNumber?: string;
    wilaya?: string;
    etablissement?: string;
    objet?: string;
  },
): Promise<void> {
  const current = await db.query.offers.findFirst({
    where: eq(offers.id, offerId),
  });

  if (!current) return;

  const updates: Record<string, any> = { updatedAt: new Date() };

  if (!current.consultationNumber && extracted.consultationNumber) {
    updates.consultationNumber = extracted.consultationNumber;
  }
  if (!current.wilaya && extracted.wilaya) {
    updates.wilaya = extracted.wilaya;
  }
  if (!current.establishment && extracted.etablissement) {
    updates.establishment = extracted.etablissement;
  }
  if (!current.title && extracted.objet) {
    updates.title = extracted.objet.slice(0, 255);
  }

  if (Object.keys(updates).length > 1) {
    await db.update(offers).set(updates).where(eq(offers.id, offerId));
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
