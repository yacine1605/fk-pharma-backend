/**
 * openai-supplier-intelligence.ts
 * OpenAI-powered supplier extraction, query generation, and equipment classification
 * for Algerian medical procurement.
 * FIXED: Compatible with older OpenAI SDK versions (no .beta.chat.completions.parse)
 */
import { z } from "zod";
declare const EquipmentClassificationSchema: z.ZodObject<{
    category: z.ZodEnum<["Diagnostic", "Surgical", "Emergency", "Laboratory", "Sterilization", "Patient_Monitoring", "Consumables", "Imaging", "Rehabilitation", "Pharmaceutical"]>;
    subcategory: z.ZodString;
    frenchSearchTerms: z.ZodArray<z.ZodString, "many">;
    arabicSearchTerms: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    typicalSuppliers: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    category: "Diagnostic" | "Surgical" | "Emergency" | "Laboratory" | "Sterilization" | "Patient_Monitoring" | "Consumables" | "Imaging" | "Rehabilitation" | "Pharmaceutical";
    subcategory: string;
    frenchSearchTerms: string[];
    typicalSuppliers: string[];
    arabicSearchTerms?: string[] | undefined;
}, {
    category: "Diagnostic" | "Surgical" | "Emergency" | "Laboratory" | "Sterilization" | "Patient_Monitoring" | "Consumables" | "Imaging" | "Rehabilitation" | "Pharmaceutical";
    subcategory: string;
    frenchSearchTerms: string[];
    typicalSuppliers: string[];
    arabicSearchTerms?: string[] | undefined;
}>;
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
export declare function extractSuppliersWithAI(searchResults: Array<{
    title: string;
    snippet: string;
    url: string;
}>, equipmentQuery: string): Promise<StructuredSupplier[]>;
export declare function generateOptimizedQueries(equipmentName: string, categoryHint?: string, count?: number): Promise<string[]>;
export declare function classifyEquipment(description: string): Promise<z.infer<typeof EquipmentClassificationSchema>>;
export declare function recommendSuppliersForMissingItem(itemName: string, classification: z.infer<typeof EquipmentClassificationSchema>): Promise<SupplierRecommendation[]>;
export {};
//# sourceMappingURL=openai-supplier-intelligence.d.ts.map