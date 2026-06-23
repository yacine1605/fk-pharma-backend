/**
 * best-offer-export.ts
 * Best offer selection, Excel generation, and missing-items reporting
 * with OpenAI-enhanced supplier intelligence.
 *
 * ← CORRIGÉ: N+1 fix - Utilise searchOnlineSuppliersBatch au lieu de boucle séquentielle
 */
import ExcelJS from "exceljs";
export type BestOfferLine = {
    rowNumber: number;
    supplierName: string | null;
    lot: number | null;
    product: string;
    unitPrice: number;
    quantity: number;
    requestedQuantity: number;
    marginRate: number;
    tvaRate: number;
    isOnlineSearch: boolean;
    onlineSuppliers: string[];
    conformityPercentage: number;
    isTechnicallyCompliant: boolean;
    originalSupplierPrice: number;
    aiRecommendations: string;
    unit?: string | null;
    hasTechnicalSheet?: boolean;
    dueDate?: string | null;
    deliveryDelay?: string | null;
    afterSalesService?: string | null;
    remarks?: string | null;
    selectionReason?: string | null;
    validityDays?: number | null;
    paymentTerms?: string | null;
};
export type BestOfferResult = {
    offerId: string;
    title: string;
    medicalEntityName: string | null;
    lines: BestOfferLine[];
    totalHT: number;
    totalTVA: number;
    totalTTC: number;
    missingItems: MissingItem[];
};
export type MissingItem = {
    itemNumber: number;
    itemName: string;
    onlineSuppliers: string[];
    aiRecommendations: string;
    classificationCategory: string;
};
export declare function selectBestOffersForCahier(offerId: string, options?: {
    marginRate?: number;
    tvaRate?: number;
    defaultQuantity?: number;
}): Promise<BestOfferResult>;
export declare function generateBestOfferExcel(result: BestOfferResult): Promise<{
    fileName: string;
    filePath: string;
}>;
export declare function generateMissingItemsSheet(workbook: ExcelJS.Workbook, missingItems: MissingItem[]): Promise<void>;
export declare function generateBestOfferExport(offerId: string): Promise<{
    fileName: string;
    filePath: string;
    fileUrl: string;
    summary: {
        totalItems: number;
        matchedItems: number;
        missingItems: number;
        totalHT: number;
        totalTVA: number;
        totalTTC: number;
    };
    missingItems: {
        itemNumber: number;
        itemName: string;
        category: string;
        suppliersFound: number;
    }[];
}>;
//# sourceMappingURL=best-offer.service.d.ts.map