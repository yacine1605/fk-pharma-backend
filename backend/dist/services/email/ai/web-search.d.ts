/**
 * web-search.ts
 * Web search utility for finding online Algerian medical suppliers.
 */
import { classifyEquipment, type StructuredSupplier, type SupplierRecommendation } from "./openai-supplier-intelligence";
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
export declare function searchOnlineSuppliersBatch(items: Array<{
    name: string;
    id: string;
}>, maxResultsPerItem?: number): Promise<Map<string, EnrichedSearchResult>>;
export declare function performWebSearch(query: string, maxResults?: number): Promise<WebSearchResult[]>;
export declare function performBingSearch(query: string, maxResults?: number): Promise<WebSearchResult[]>;
export declare function searchOnlineSuppliersAI(itemName: string, maxResults?: number): Promise<EnrichedSearchResult>;
export declare function extractCompanyName(title: string, snippet: string): string | null;
//# sourceMappingURL=web-search.d.ts.map