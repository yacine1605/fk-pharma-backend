/**
 * web-search.ts
 * Web search utility for finding online Algerian medical suppliers.
 */

import fetch from "node-fetch";
import {
  extractSuppliersWithAI,
  generateOptimizedQueries,
  classifyEquipment,
  recommendSuppliersForMissingItem,
  type StructuredSupplier,
  type SupplierRecommendation,
} from "./openai-supplier-intelligence";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
  source: string;
}

export interface EnrichedSearchResult {
  suppliers: string[];
  structuredSuppliers: StructuredSupplier[];
  classification: Awaited<ReturnType<typeof classifyEquipment>>;
  aiRecommendations: SupplierRecommendation[];
}

const MAX_CONCURRENT_SEARCHES = 5;

// ─────────────────────────────────────────────
// HELPER: Safe error logging
// ─────────────────────────────────────────────

function safeLogError(label: string, err: unknown): void {
  try {
    if (err instanceof Error) {
      console.error(label, {
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
    } else {
      console.error(label, String(err));
    }
  } catch (logErr) {
    console.error(label, "[failed to log error]", String(logErr));
  }
}

// ─────────────────────────────────────────────
// 1. SERPAPI SEARCH (Primary)
// ─────────────────────────────────────────────

export async function searchOnlineSuppliersBatch(
  items: Array<{ name: string; id: string }>,
  maxResultsPerItem: number = 5,
): Promise<Map<string, EnrichedSearchResult>> {
  const results = new Map<string, EnrichedSearchResult>();

  for (let i = 0; i < items.length; i += MAX_CONCURRENT_SEARCHES) {
    const chunk = items.slice(i, i + MAX_CONCURRENT_SEARCHES);

    const chunkResults = await Promise.all(
      chunk.map(async (item) => {
        const result = await searchOnlineSuppliersAI(
          item.name,
          maxResultsPerItem,
        );
        return { id: item.id, result };
      }),
    );

    for (const { id, result } of chunkResults) {
      results.set(id, result);
    }
  }

  return results;
}

export async function performWebSearch(
  query: string,
  maxResults: number = 5,
): Promise<WebSearchResult[]> {
  const apiKey = process.env.SERP_API_KEY;

  if (!apiKey) {
    console.warn("[WEB SEARCH] No SERP_API_KEY found, using mock data");
    return getMockSearchResults(query);
  }

  try {
    const searchUrl = new URL("https://serpapi.com/search");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("api_key", apiKey);
    searchUrl.searchParams.set("hl", "fr");
    searchUrl.searchParams.set("gl", "dz");
    searchUrl.searchParams.set("num", String(maxResults));
    searchUrl.searchParams.set("engine", "google");

    // Use AbortController instead of timeout (works with all node-fetch versions)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(searchUrl.toString(), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(
        `SerpAPI error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as any;

    const results: WebSearchResult[] =
      data.organic_results?.map((r: any) => ({
        title: r.title || "",
        snippet: r.snippet || r.description || "",
        url: r.link || r.url || "",
        source: "serpapi",
      })) || [];

    if (results.length === 0) {
      console.warn("[WEB SEARCH] No results from SerpAPI, using fallback");
      return getMockSearchResults(query);
    }

    return results;
  } catch (error) {
    safeLogError("[WEB SEARCH ERROR]", error);
    return getMockSearchResults(query);
  }
}

// ─────────────────────────────────────────────
// 2. BING SEARCH API (Alternative)
// ─────────────────────────────────────────────

export async function performBingSearch(
  query: string,
  maxResults: number = 5,
): Promise<WebSearchResult[]> {
  const apiKey = process.env.BING_SEARCH_API_KEY;

  if (!apiKey) {
    return performWebSearch(query, maxResults);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(
      `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=${maxResults}&mkt=fr-FR`,
      {
        headers: { "Ocp-Apim-Subscription-Key": apiKey },
        signal: controller.signal,
      },
    );

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Bing API error: ${response.status}`);
    }

    const data = (await response.json()) as any;

    return (
      data.webPages?.value?.map((r: any) => ({
        title: r.name || "",
        snippet: r.snippet || "",
        url: r.url || "",
        source: "bing",
      })) || []
    );
  } catch (error) {
    safeLogError("[BING SEARCH ERROR]", error);
    return performWebSearch(query, maxResults);
  }
}

// ─────────────────────────────────────────────
// 3. AI-ENHANCED SUPPLIER SEARCH (Main Export)
// ─────────────────────────────────────────────

export async function searchOnlineSuppliersAI(
  itemName: string,
  maxResults: number = 8,
): Promise<EnrichedSearchResult> {
  const classification = await classifyEquipment(itemName);
  const queries = await generateOptimizedQueries(
    itemName,
    classification.subcategory,
    3,
  );

  const searchPromises = queries.map(async (q) => {
    const serpResults = await performWebSearch(
      q,
      Math.ceil(maxResults / queries.length),
    );
    if (serpResults.length > 0 && serpResults[0].source !== "mock") {
      return serpResults;
    }
    return performBingSearch(q, Math.ceil(maxResults / queries.length));
  });

  const searchResults = (await Promise.all(searchPromises)).flat();

  const seen = new Set<string>();
  const uniqueResults = searchResults.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  const structuredSuppliers = await extractSuppliersWithAI(
    uniqueResults,
    itemName,
  );

  const aiRecommendations = await recommendSuppliersForMissingItem(
    itemName,
    classification,
  );

  const structuredNames = structuredSuppliers.map((s) =>
    s.legalForm && !s.companyName.toUpperCase().startsWith(s.legalForm)
      ? `${s.legalForm} ${s.companyName}`
      : s.companyName,
  );

  const aiNames = aiRecommendations
    .filter((r) => r.likelihood === "high" || r.likelihood === "medium")
    .map((r) => r.name);

  const allNames = Array.from(new Set([...structuredNames, ...aiNames]));

  return {
    suppliers:
      allNames.length > 0
        ? allNames
        : classification.typicalSuppliers.length > 0
          ? classification.typicalSuppliers
          : ["Aucun fournisseur identifié"],
    structuredSuppliers,
    classification,
    aiRecommendations,
  };
}

// ─────────────────────────────────────────────
// 4. LEGACY REGEX EXTRACTION (Non-AI fallback)
// ─────────────────────────────────────────────

export function extractCompanyName(
  title: string,
  snippet: string,
): string | null {
  const text = `${title} ${snippet}`;

  const patterns = [
    /(SARL|EURL|SPA|ETS|GIE|SNC|SCS)\s+([A-Za-z0-9\s&\-\.]+)/i,
    /([A-Z][a-z]+\s+(?:Medical|Pharma|Biomed|Health|Care|Lab|Diag|Medline|Company))/i,
    /(?:fournisseur|distributeur)\s+[:\-]?\s*([A-Za-z0-9\s&\-\.]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].trim().substring(0, 50);
    }
  }

  const words = text
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .slice(0, 4);
  if (words.length >= 2) {
    return words
      .join(" ")
      .replace(/[^\w\s&\-\.]/g, "")
      .trim();
  }

  return null;
}

// ─────────────────────────────────────────────
// 5. MOCK DATA (Fallback when no API keys)
// ─────────────────────────────────────────────

function getMockSearchResults(query: string): WebSearchResult[] {
  const normalizedQuery = query.toLowerCase();

  const knownSuppliers: Record<string, string[]> = {
    default: [
      "MED COMPANY - Dispositifs médicaux et chirurgicaux",
      "IMALAB - Équipement médical Constantine",
      "SARL TMM - Importation matériel médical",
      "BIOMEDIC SARL Constantine",
      "HCM Innov Group - Distribution médicale",
      "MEDICO MEDLINE - Matériel médical",
      "WORLDLAB - Équipements laboratoires",
      "KARTILI MEDICAL - Import export médical",
      "SARL ALMED - Algiers",
      "EURL Top Medical - Tlemcen",
    ],
    desinfectant: [
      "BIOMEDIC SARL - Désinfectants médicaux",
      "MED COMPANY - Produits d'hygiène hospitalière",
      "BIOSAFE ALGERIE - Solutions désinfectantes",
    ],
    moniteur: [
      "SARL TMM - Moniteurs patients",
      "IMALAB - Moniteurs multiparamètres",
      "MED COMPANY - Équipement surveillance",
    ],
    defibrillateur: [
      "MED COMPANY - Défibrillateurs DAE",
      "BIOMEDIC SARL - Équipement d'urgence",
      "HCM Innov Group - Dispositifs cardiaques",
    ],
    electrocardiogramme: [
      "IMALAB - Électrocardiographes",
      "SARL TMM - ECG 12 dérivations",
      "MED COMPANY - Appareils ECG",
    ],
    sterilisation: [
      "BIOMEDIC SARL - Autoclaves et stérilisateurs",
      "WORLDLAB - Équipement stérilisation",
      "MED COMPANY - Consommables stérilisation",
    ],
  };

  let suppliers = knownSuppliers.default;
  for (const [keyword, list] of Object.entries(knownSuppliers)) {
    if (keyword !== "default" && normalizedQuery.includes(keyword)) {
      suppliers = list;
      break;
    }
  }

  return suppliers.map((name) => ({
    title: name,
    snippet: `Fournisseur algérien de matériel médical - ${name}`,
    url: "https://www.google.com/search?q=" + encodeURIComponent(name),
    source: "mock",
  }));
}
