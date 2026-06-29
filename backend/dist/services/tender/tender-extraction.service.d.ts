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
    autresDelais?: {
        label: string;
        date: string;
    }[];
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
export declare function processTenderDocument(documentId: string): Promise<TenderExtractionResult>;
//# sourceMappingURL=tender-extraction.service.d.ts.map