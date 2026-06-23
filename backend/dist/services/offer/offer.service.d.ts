export interface CreateOfferDTO {
    offerTitle: string;
    medicalEntity: {
        name: string;
        type: string;
        speciality: string;
        address?: string;
        city: string;
        phone?: string;
        email: string;
        contactPerson: string;
    };
    selectedTemplateId: string | null;
    emailSubject: string;
    emailBody: string;
    emailSignature: string;
    attachmentPath?: string | null;
    attachmentName?: string | null;
    attachmentSize?: number | null;
    recipientIds: string[];
}
export interface SendOfferResult {
    offerId: string;
    total: number;
    sent: number;
    failed: number;
    details: Array<{
        recipientId: string;
        recipientEmail: string;
        status: "sent" | "failed";
        error?: string;
    }>;
}
/**
 * 1. Upsert l'entité médicale (par email)
 * 2. Crée l'offre en base
 * 3. Lie les destinataires à l'offre
 * 4. Envoie les emails un par un
 * 5. Met à jour les statuts d'envoi
 */
export declare function createAndSendOffer(dto: CreateOfferDTO): Promise<SendOfferResult>;
/**
 * Sauvegarde un brouillon sans envoi
 */
export declare function saveOfferDraft(dto: CreateOfferDTO): Promise<string>;
/**
 * Liste toutes les offres avec leurs stats d'envoi
 */
export declare function listOffers(): Promise<{
    userId: string | null;
    id: string;
    createdAt: Date;
    updatedAt: Date | null;
    title: string;
    medicalEntityId: string;
    sourceOfferId: string | null;
    emailSubject: string;
    emailBody: string;
    emailSignature: string;
    attachmentName: string | null;
    attachmentPath: string | null;
    attachmentMimeType: string | null;
    attachmentSize: number | null;
    status: "draft" | "pending" | "sent" | "partial_failed" | "failed" | "completed";
    sentAt: Date | null;
    commercialName: string | null;
    consultationNumber: string | null;
    establishment: string | null;
    wilaya: string | null;
    depositLocation: string | null;
    hasTechnicalSheet: boolean | null;
    hasConformityCertificate: boolean | null;
    hasOriginCertificate: boolean | null;
    hasManufacturingCertificate: boolean | null;
    hasUserManual: boolean | null;
    hasCatalog: boolean | null;
    hasSample: boolean | null;
    warrantyDuration: string | null;
    deliveryDelay: string | null;
    savDuration: string | null;
    interventionDelay: string | null;
    savLocations: string | null;
    trainingDuration: string | null;
    procedureType: "appel_offre" | "consultation" | null;
    hospitalDepositDate: Date | null;
    technicalDepartmentDepositDate: Date | null;
    maintenanceWorkshop: string | null;
    availableTechnicalMeans: string | null;
    proformaInvoice: string | null;
    paymentSchedule: string | null;
    discountObtained: string | null;
    offerExpirationDate: Date | null;
    ddpConditions: string | null;
    siteVisitPV: boolean | null;
    pliOpeningPV: boolean | null;
    provisionalAttributionPV: boolean | null;
    definitiveAttributionPV: boolean | null;
    justiceFolder: boolean | null;
    submissionBond: boolean | null;
    goodExecutionBond: boolean | null;
    supplierCommercialAudit: string | null;
    offerRecipients: {
        id: string;
        createdAt: Date;
        status: "pending" | "sent" | "failed";
        sentAt: Date | null;
        offerId: string;
        errorMessage: string | null;
        recipientId: string;
        recipient: {
            email: string;
            role: string;
            id: string;
            password: string;
            firstName: string;
            lastName: string;
            company: string | null;
            signature: string | null;
            phone: string | null;
            createdAt: Date;
            updatedAt: Date;
        };
    }[];
    medicalEntity: {
        email: string;
        id: string;
        name: string;
        phone: string | null;
        createdAt: Date;
        updatedAt: Date;
        address: string | null;
        city: string;
        contactPerson: string;
        type: string;
        phone2: string | null;
    };
}[]>;
/**
 * Détail d'une offre par ID
 */
export declare function getOfferById(id: string): Promise<{
    userId: string | null;
    id: string;
    createdAt: Date;
    updatedAt: Date | null;
    title: string;
    medicalEntityId: string;
    sourceOfferId: string | null;
    emailSubject: string;
    emailBody: string;
    emailSignature: string;
    attachmentName: string | null;
    attachmentPath: string | null;
    attachmentMimeType: string | null;
    attachmentSize: number | null;
    status: "draft" | "pending" | "sent" | "partial_failed" | "failed" | "completed";
    sentAt: Date | null;
    commercialName: string | null;
    consultationNumber: string | null;
    establishment: string | null;
    wilaya: string | null;
    depositLocation: string | null;
    hasTechnicalSheet: boolean | null;
    hasConformityCertificate: boolean | null;
    hasOriginCertificate: boolean | null;
    hasManufacturingCertificate: boolean | null;
    hasUserManual: boolean | null;
    hasCatalog: boolean | null;
    hasSample: boolean | null;
    warrantyDuration: string | null;
    deliveryDelay: string | null;
    savDuration: string | null;
    interventionDelay: string | null;
    savLocations: string | null;
    trainingDuration: string | null;
    procedureType: "appel_offre" | "consultation" | null;
    hospitalDepositDate: Date | null;
    technicalDepartmentDepositDate: Date | null;
    maintenanceWorkshop: string | null;
    availableTechnicalMeans: string | null;
    proformaInvoice: string | null;
    paymentSchedule: string | null;
    discountObtained: string | null;
    offerExpirationDate: Date | null;
    ddpConditions: string | null;
    siteVisitPV: boolean | null;
    pliOpeningPV: boolean | null;
    provisionalAttributionPV: boolean | null;
    definitiveAttributionPV: boolean | null;
    justiceFolder: boolean | null;
    submissionBond: boolean | null;
    goodExecutionBond: boolean | null;
    supplierCommercialAudit: string | null;
    offerRecipients: {
        id: string;
        createdAt: Date;
        status: "pending" | "sent" | "failed";
        sentAt: Date | null;
        offerId: string;
        errorMessage: string | null;
        recipientId: string;
        recipient: {
            email: string;
            role: string;
            id: string;
            password: string;
            firstName: string;
            lastName: string;
            company: string | null;
            signature: string | null;
            phone: string | null;
            createdAt: Date;
            updatedAt: Date;
        };
    }[];
    medicalEntity: {
        email: string;
        id: string;
        name: string;
        phone: string | null;
        createdAt: Date;
        updatedAt: Date;
        address: string | null;
        city: string;
        contactPerson: string;
        type: string;
        phone2: string | null;
    };
} | undefined>;
//# sourceMappingURL=offer.service.d.ts.map