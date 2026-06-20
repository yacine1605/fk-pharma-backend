/**
 * openai-supplier-intelligence.ts
 * OpenAI-powered supplier extraction, query generation, and equipment classification
 * for Algerian medical procurement.
 * FIXED: Compatible with older OpenAI SDK versions (no .beta.chat.completions.parse)
 */

import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ─────────────────────────────────────────────
// ZOD SCHEMAS
// ─────────────────────────────────────────────

const SupplierExtractionSchema = z.object({
  suppliers: z.array(
    z.object({
      companyName: z.string(),
      legalForm: z
        .enum(["SARL", "EURL", "SPA", "ETS", "GIE", "SNC", "SCS", ""])
        .nullable(),
      city: z.string().nullable(),
      specialties: z.array(z.string()),
      confidence: z.number().min(0).max(1),
      isAlgerian: z.boolean(),
      contactHint: z.string().nullable(),
    }),
  ),
});

const SearchQuerySchema = z.object({
  queries: z.array(z.string()).min(1).max(6),
});

const EquipmentClassificationSchema = z.object({
  category: z.enum([
    "Diagnostic",
    "Surgical",
    "Emergency",
    "Laboratory",
    "Sterilization",
    "Patient_Monitoring",
    "Consumables",
    "Imaging",
    "Rehabilitation",
    "Pharmaceutical",
  ]),
  subcategory: z.string(),
  frenchSearchTerms: z.array(z.string()),
  arabicSearchTerms: z.array(z.string()).optional(),
  typicalSuppliers: z.array(z.string()),
});

const RecommendationSchema = z.object({
  recommendations: z.array(
    z.object({
      name: z.string(),
      reason: z.string(),
      likelihood: z.enum(["high", "medium", "low"]),
    }),
  ),
});

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface StructuredSupplier {
  companyName: string;
  legalForm: string | null;
  city: string | null;
  specialties: string[];
  confidence: number;
  isAlgerian: boolean;
  contactHint: string | null;
}

export interface SupplierRecommendation {
  name: string;
  reason: string;
  likelihood: "high" | "medium" | "low";
}

// ─────────────────────────────────────────────
// HELPER: Safe error logging (prevents util.inspect crash)
// ─────────────────────────────────────────────

function safeLogError(label: string, err: unknown): void {
  try {
    if (err instanceof z.ZodError) {
      console.error(label, "ZodError:", err.issues);
      return;
    }
    if (err instanceof Error) {
      const safe: Record<string, unknown> = {
        name: err.name,
        message: err.message,
        stack: err.stack,
      };
      // OpenAI SDK errors often attach a `response` object with circular getters
      if ("response" in err) {
        try {
          safe.response = JSON.stringify((err as any).response, null, 2);
        } catch {
          safe.response = "[unserializable response]";
        }
      }
      console.error(label, safe);
      return;
    }
    console.error(label, String(err));
  } catch (logErr) {
    console.error(label, "[failed to log error]", String(logErr));
  }
}

// ─────────────────────────────────────────────
// HELPER: Safe AI call with JSON mode + Zod validation
// ─────────────────────────────────────────────

async function aiParse<T extends z.ZodTypeAny>(
  prompt: string,
  schema: T,
  systemContent?: string,
): Promise<z.infer<T> | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  let raw: string | null = null;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        ...(systemContent
          ? [{ role: "system" as const, content: systemContent }]
          : []),
        { role: "user" as const, content: prompt },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
      max_tokens: 2000,
    });

    raw = completion.choices[0]?.message?.content ?? null;
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return schema.parse(parsed);
  } catch (error) {
    safeLogError("[AI PARSE ERROR]", error);
    // Log raw response for debugging (only if it exists)
    if (raw) {
      console.error("[AI PARSE RAW RESPONSE]", raw.substring(0, 2000));
    }
    return null;
  }
}

// ─────────────────────────────────────────────
// 1. AI-POWERED SUPPLIER EXTRACTION
// ─────────────────────────────────────────────

export async function extractSuppliersWithAI(
  searchResults: Array<{ title: string; snippet: string; url: string }>,
  equipmentQuery: string,
): Promise<StructuredSupplier[]> {
  if (!process.env.OPENAI_API_KEY) {
    return searchResults.flatMap((r) => legacyExtract(r.title, r.snippet));
  }

  const prompt = `
Analyse ces résultats de recherche Google pour en extraire les fournisseurs algériens de matériel médical.

Requête initiale : "${equipmentQuery}"

Résultats de recherche :
${searchResults
  .map(
    (r, i) => `
[${i + 1}] Titre : ${r.title}
    Extrait : ${r.snippet}
    URL : ${r.url}`,
  )
  .join("\n")}

Règles d'extraction :
- Extraire UNIQUEMENT les entreprises qui semblent opérer en Algérie
- Formes juridiques : SARL, EURL, SPA, ETS, GIE, SNC, SCS
- confidence = 0.9 si nom + forme juridique + ville algérienne
- confidence = 0.6 si nom + indication algérienne
- confidence = 0.3 si mention vague
- Retourner UNIQUEMENT un JSON valide correspondant au schéma demandé.
`;

  const parsed = await aiParse(
    prompt,
    SupplierExtractionSchema,
    "Tu es un assistant d'extraction de données spécialisé dans les fournisseurs de matériel médical algériens.",
  );

  if (!parsed || !parsed.suppliers) {
    return searchResults.flatMap((r) => legacyExtract(r.title, r.snippet));
  }

  return parsed.suppliers
    .filter((s: any) => s.isAlgerian && s.confidence >= 0.3)
    .map((s: any) => ({
      companyName: s.companyName.trim(),
      legalForm: s.legalForm || null,
      city: s.city,
      specialties: s.specialties,
      confidence: s.confidence,
      isAlgerian: s.isAlgerian,
      contactHint: s.contactHint,
    }));
}

// ─────────────────────────────────────────────
// 2. AI-GENERATED SEARCH QUERIES
// ─────────────────────────────────────────────

export async function generateOptimizedQueries(
  equipmentName: string,
  categoryHint?: string,
  count: number = 4,
): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) {
    return [
      `${equipmentName} fournisseur Algérie`,
      `${equipmentName} médical Algerie prix`,
      `${equipmentName} SARL EURL Algerie`,
      `achat ${equipmentName} hopital Algerie`,
    ];
  }

  const prompt = `
Génère ${count} requêtes de recherche Google en français pour trouver des fournisseurs algériens de : "${equipmentName}"
${categoryHint ? `Catégorie suggérée : ${categoryHint}` : ""}

Contraintes :
- Langue : français
- Cible : Google Algérie (hl=fr, gl=dz)
- Varier entre requêtes commerciales et techniques
- Inclure parfois une forme juridique (SARL, EURL)
- Retourner UNIQUEMENT un objet JSON avec un champ "queries" contenant un tableau de strings.
`;

  const parsed = await aiParse(prompt, SearchQuerySchema);
  return parsed?.queries || [`${equipmentName} fournisseur Algérie`];
}

// ─────────────────────────────────────────────
// 3. EQUIPMENT CLASSIFICATION
// ─────────────────────────────────────────────

export async function classifyEquipment(
  description: string,
): Promise<z.infer<typeof EquipmentClassificationSchema>> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      category: "Diagnostic",
      subcategory: "Général",
      frenchSearchTerms: [description],
      typicalSuppliers: [],
    };
  }

  const prompt = `
Classifie ce matériel médical pour un marché public algérien :
"${description}"

Fournis la catégorie, sous-catégorie, termes de recherche en français (et arabe si pertinent), et des noms types de fournisseurs algériens.
Retourner UNIQUEMENT un objet JSON valide.
`;

  const parsed = await aiParse(
    prompt,
    EquipmentClassificationSchema,
    "Tu es un expert en marchés publics algériens de matériel médical.",
  );

  return (
    parsed || {
      category: "Diagnostic",
      subcategory: "Général",
      frenchSearchTerms: [description],
      typicalSuppliers: [],
    }
  );
}

// ─────────────────────────────────────────────
// 4. AI SUPPLIER RECOMMENDATIONS FOR MISSING ITEMS
// ─────────────────────────────────────────────

export async function recommendSuppliersForMissingItem(
  itemName: string,
  classification: z.infer<typeof EquipmentClassificationSchema>,
): Promise<SupplierRecommendation[]> {
  if (!process.env.OPENAI_API_KEY) return [];

  const prompt = `
Recommande 3 à 5 fournisseurs algériens probables pour : "${itemName}"
Catégorie : ${classification.category} / ${classification.subcategory}
Termes de recherche associés : ${classification.frenchSearchTerms.join(", ")}

Instructions :
- Propose des noms réalistes d'entreprises algériennes de matériel médical
- Explique en UNE phrase pourquoi chacun pourrait distribuer cet article
- likelihood = "high" si distributeur généraliste ou spécialiste évident
- likelihood = "medium" si plausible mais pas certain
- likelihood = "low" si possibilité lointaine
- Retourner UNIQUEMENT un objet JSON avec un champ "recommendations".
`;

  const parsed = await aiParse(prompt, RecommendationSchema);
  return parsed?.recommendations || [];
}

// ─────────────────────────────────────────────
// LEGACY FALLBACK (Regex-based)
// ─────────────────────────────────────────────

function legacyExtract(title: string, snippet: string): StructuredSupplier[] {
  const text = `${title} ${snippet}`;
  const results: StructuredSupplier[] = [];

  const legalMatch = text.match(
    /(SARL|EURL|SPA|ETS|GIE|SNC|SCS)\s+([A-Za-z0-9\s&\-\.]+)/i,
  );
  const cityMatch = text.match(
    /\b(Alger|Algiers|Constantine|Oran|Tlemcen|Annaba|Blida|Setif|Sétif|Béjaïa|Batna|Biskra|Boumerdès)\b/i,
  );

  if (legalMatch || cityMatch || /alg[eé]rie|algeria|dz\b/i.test(text)) {
    const rawName = legalMatch
      ? legalMatch[0].trim()
      : title.split(/\s+/).slice(0, 4).join(" ");

    results.push({
      companyName: rawName.substring(0, 50),
      legalForm: legalMatch ? legalMatch[1].toUpperCase() : null,
      city: cityMatch ? cityMatch[1] : null,
      specialties: [],
      confidence: legalMatch && cityMatch ? 0.5 : 0.3,
      isAlgerian: /alg[eé]rie|algeria|dz\b/i.test(text),
      contactHint: null,
    });
  }

  return results;
}
