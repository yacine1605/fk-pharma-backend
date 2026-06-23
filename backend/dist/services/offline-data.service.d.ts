/**
 * offline-data.service.ts
 * Wrapper IndexedDB pour le mode offline
 * Stocke les données critiques localement pour consultation hors connexion
 */
interface OfflineOffer {
    id: string;
    title: string;
    medicalEntityName: string | null;
    status: string;
    technicalDepartmentDepositDate: string | null;
    hospitalDepositDate: string | null;
    procedureType: string | null;
    itemsCount: number;
    suppliersCount: number;
    lastSynced: string;
}
interface OfflineOfferDetail extends OfflineOffer {
    items: Array<{
        id: string;
        itemNumber: number;
        name: string;
        requestedQuantity: number;
        unit: string | null;
        technicalRequirements: unknown;
    }>;
    suppliers: Array<{
        id: string;
        name: string;
        status: string;
        conformityPercentage: number | null;
    }>;
    bestOffer: {
        totalHT: number;
        totalTVA: number;
        totalTTC: number;
        lines: Array<{
            product: string;
            supplierName: string | null;
            unitPrice: number;
            quantity: number;
            conformityPercentage: number;
        }>;
    } | null;
}
declare class OfflineDatabase {
    private db;
    init(): Promise<void>;
    saveOfferList(offers: OfflineOffer[]): Promise<void>;
    getOfferList(): Promise<OfflineOffer[]>;
    saveOfferDetail(detail: OfflineOfferDetail): Promise<void>;
    getOfferDetail(offerId: string): Promise<OfflineOfferDetail | null>;
    deleteOffer(offerId: string): Promise<void>;
    isOnline(): Promise<boolean>;
    syncIfOnline(): Promise<{
        synced: number;
        failed: number;
    }>;
}
export declare const offlineDB: OfflineDatabase;
/**
 * Hook React pour le mode offline
 */
export declare function useOfflineStatus(): {
    isOnline: any;
    isSyncing: boolean;
    sync: () => Promise<void>;
};
export {};
//# sourceMappingURL=offline-data.service.d.ts.map