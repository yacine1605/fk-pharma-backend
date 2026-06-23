/**
 * Option 2 Mapper
 *
 * The frontend ALWAYS renders from `lots[]`.
 * If the DB stores multi-lot data → return it as-is.
 * If the DB stores legacy single-lot data (global fields) → synthesize
 * a single lot so the frontend has a uniform structure.
 */
export interface NormalizedLot {
    id: string;
    lotNumber: string;
    lotObject: string;
    technicalDocuments: {
        hasTechnicalSheet: boolean;
        hasConformityCertificate: boolean;
        hasOriginCertificate: boolean;
        hasManufacturingCertificate: boolean;
        hasCatalog: boolean;
        hasUserManual: boolean;
        hasSample: boolean;
    };
    clientRequirements: {
        particularPrescriptions: string;
        warrantyDuration: string;
        deliveryDelay: string;
        savDuration: string;
        interventionDelay: string;
        savLocations: string;
        trainingDuration: string;
    };
    createdAt: Date | string | null;
}
export declare function safeParseJsonb<T>(value: unknown): T | null;
export declare function normalizeOfferLots(offer: any): NormalizedLot[];
//# sourceMappingURL=offer.mapper.d.ts.map