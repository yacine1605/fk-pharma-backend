import { z } from "zod";
export declare const medicalEntitySchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodString;
    speciality: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    address: z.ZodOptional<z.ZodString>;
    city: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    email: z.ZodString;
    contactPerson: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    name: string;
    city: string;
    contactPerson: string;
    type: string;
    speciality: string;
    phone?: string | undefined;
    address?: string | undefined;
}, {
    email: string;
    name: string;
    city: string;
    contactPerson: string;
    type: string;
    phone?: string | undefined;
    address?: string | undefined;
    speciality?: string | undefined;
}>;
export declare const createOfferSchema: z.ZodObject<{
    sourceOfferId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    offerTitle: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    selectedTemplateId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    medicalEntity: z.ZodObject<{
        name: z.ZodString;
        type: z.ZodString;
        speciality: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        address: z.ZodOptional<z.ZodString>;
        city: z.ZodString;
        phone: z.ZodOptional<z.ZodString>;
        email: z.ZodString;
        contactPerson: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        email: string;
        name: string;
        city: string;
        contactPerson: string;
        type: string;
        speciality: string;
        phone?: string | undefined;
        address?: string | undefined;
    }, {
        email: string;
        name: string;
        city: string;
        contactPerson: string;
        type: string;
        phone?: string | undefined;
        address?: string | undefined;
        speciality?: string | undefined;
    }>;
    emailSubject: z.ZodString;
    emailBody: z.ZodString;
    emailSignature: z.ZodString;
    recipientIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    supplierIds: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    attachments: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        filePath: z.ZodString;
        fileName: z.ZodString;
        mimeType: z.ZodString;
        fileSize: z.ZodNumber;
        attachmentType: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        fileName: string;
        filePath: string;
        attachmentType: string;
        mimeType: string;
        fileSize: number;
    }, {
        fileName: string;
        filePath: string;
        mimeType: string;
        fileSize: number;
        attachmentType?: string | undefined;
    }>, "many">>>;
    commercialName: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    consultationNumber: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    establishment: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    wilaya: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    depositLocation: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    lots: z.ZodOptional<z.ZodArray<z.ZodObject<{
        number: z.ZodString;
        object: z.ZodString;
        technicalDocuments: z.ZodDefault<z.ZodObject<{
            hasTechnicalSheet: z.ZodDefault<z.ZodBoolean>;
            hasConformityCertificate: z.ZodDefault<z.ZodBoolean>;
            hasOriginCertificate: z.ZodDefault<z.ZodBoolean>;
            hasManufacturingCertificate: z.ZodDefault<z.ZodBoolean>;
            hasCatalog: z.ZodDefault<z.ZodBoolean>;
            hasUserManual: z.ZodDefault<z.ZodBoolean>;
            hasSample: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            hasTechnicalSheet: boolean;
            hasConformityCertificate: boolean;
            hasOriginCertificate: boolean;
            hasManufacturingCertificate: boolean;
            hasUserManual: boolean;
            hasCatalog: boolean;
            hasSample: boolean;
        }, {
            hasTechnicalSheet?: boolean | undefined;
            hasConformityCertificate?: boolean | undefined;
            hasOriginCertificate?: boolean | undefined;
            hasManufacturingCertificate?: boolean | undefined;
            hasUserManual?: boolean | undefined;
            hasCatalog?: boolean | undefined;
            hasSample?: boolean | undefined;
        }>>;
        clientRequirements: z.ZodDefault<z.ZodObject<{
            particularPrescriptions: z.ZodDefault<z.ZodString>;
            warrantyDuration: z.ZodDefault<z.ZodString>;
            deliveryDelay: z.ZodDefault<z.ZodString>;
            savDuration: z.ZodDefault<z.ZodString>;
            interventionDelay: z.ZodDefault<z.ZodString>;
            savLocations: z.ZodDefault<z.ZodString>;
            trainingDuration: z.ZodDefault<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            warrantyDuration: string;
            deliveryDelay: string;
            savDuration: string;
            interventionDelay: string;
            savLocations: string;
            trainingDuration: string;
            particularPrescriptions: string;
        }, {
            warrantyDuration?: string | undefined;
            deliveryDelay?: string | undefined;
            savDuration?: string | undefined;
            interventionDelay?: string | undefined;
            savLocations?: string | undefined;
            trainingDuration?: string | undefined;
            particularPrescriptions?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        number: string;
        object: string;
        technicalDocuments: {
            hasTechnicalSheet: boolean;
            hasConformityCertificate: boolean;
            hasOriginCertificate: boolean;
            hasManufacturingCertificate: boolean;
            hasUserManual: boolean;
            hasCatalog: boolean;
            hasSample: boolean;
        };
        clientRequirements: {
            warrantyDuration: string;
            deliveryDelay: string;
            savDuration: string;
            interventionDelay: string;
            savLocations: string;
            trainingDuration: string;
            particularPrescriptions: string;
        };
    }, {
        number: string;
        object: string;
        technicalDocuments?: {
            hasTechnicalSheet?: boolean | undefined;
            hasConformityCertificate?: boolean | undefined;
            hasOriginCertificate?: boolean | undefined;
            hasManufacturingCertificate?: boolean | undefined;
            hasUserManual?: boolean | undefined;
            hasCatalog?: boolean | undefined;
            hasSample?: boolean | undefined;
        } | undefined;
        clientRequirements?: {
            warrantyDuration?: string | undefined;
            deliveryDelay?: string | undefined;
            savDuration?: string | undefined;
            interventionDelay?: string | undefined;
            savLocations?: string | undefined;
            trainingDuration?: string | undefined;
            particularPrescriptions?: string | undefined;
        } | undefined;
    }>, "many">>;
    warrantyDuration: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    deliveryDelay: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    savDuration: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    interventionDelay: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    savLocations: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    trainingDuration: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    supplierCommercialAudit: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    hasTechnicalSheet: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    hasConformityCertificate: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    hasOriginCertificate: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    hasManufacturingCertificate: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    hasUserManual: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    hasCatalog: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    hasSample: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    procedureType: z.ZodNullable<z.ZodOptional<z.ZodEnum<["appel_offre", "consultation"]>>>;
    hospitalDepositDate: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodDate>>, Date | null | undefined, unknown>;
    technicalDepartmentDepositDate: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodDate>>, Date | null | undefined, unknown>;
    attachmentPath: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    attachmentUrl: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    attachmentName: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    attachmentSize: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    attachmentMimeType: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    emailSubject: string;
    emailBody: string;
    emailSignature: string;
    commercialName: string;
    consultationNumber: string;
    establishment: string;
    wilaya: string;
    depositLocation: string;
    hasTechnicalSheet: boolean;
    hasConformityCertificate: boolean;
    hasOriginCertificate: boolean;
    hasManufacturingCertificate: boolean;
    hasUserManual: boolean;
    hasCatalog: boolean;
    hasSample: boolean;
    warrantyDuration: string;
    deliveryDelay: string;
    savDuration: string;
    interventionDelay: string;
    savLocations: string;
    trainingDuration: string;
    supplierCommercialAudit: string;
    medicalEntity: {
        email: string;
        name: string;
        city: string;
        contactPerson: string;
        type: string;
        speciality: string;
        phone?: string | undefined;
        address?: string | undefined;
    };
    attachments: {
        fileName: string;
        filePath: string;
        attachmentType: string;
        mimeType: string;
        fileSize: number;
    }[];
    offerTitle: string;
    recipientIds: string[];
    supplierIds: string[];
    sourceOfferId?: string | null | undefined;
    attachmentName?: string | null | undefined;
    attachmentPath?: string | null | undefined;
    attachmentMimeType?: string | null | undefined;
    attachmentSize?: number | null | undefined;
    procedureType?: "appel_offre" | "consultation" | null | undefined;
    hospitalDepositDate?: Date | null | undefined;
    technicalDepartmentDepositDate?: Date | null | undefined;
    lots?: {
        number: string;
        object: string;
        technicalDocuments: {
            hasTechnicalSheet: boolean;
            hasConformityCertificate: boolean;
            hasOriginCertificate: boolean;
            hasManufacturingCertificate: boolean;
            hasUserManual: boolean;
            hasCatalog: boolean;
            hasSample: boolean;
        };
        clientRequirements: {
            warrantyDuration: string;
            deliveryDelay: string;
            savDuration: string;
            interventionDelay: string;
            savLocations: string;
            trainingDuration: string;
            particularPrescriptions: string;
        };
    }[] | undefined;
    selectedTemplateId?: string | null | undefined;
    attachmentUrl?: string | null | undefined;
}, {
    emailSubject: string;
    emailBody: string;
    emailSignature: string;
    medicalEntity: {
        email: string;
        name: string;
        city: string;
        contactPerson: string;
        type: string;
        phone?: string | undefined;
        address?: string | undefined;
        speciality?: string | undefined;
    };
    sourceOfferId?: string | null | undefined;
    attachmentName?: string | null | undefined;
    attachmentPath?: string | null | undefined;
    attachmentMimeType?: string | null | undefined;
    attachmentSize?: number | null | undefined;
    commercialName?: string | undefined;
    consultationNumber?: string | undefined;
    establishment?: string | undefined;
    wilaya?: string | undefined;
    depositLocation?: string | undefined;
    hasTechnicalSheet?: boolean | undefined;
    hasConformityCertificate?: boolean | undefined;
    hasOriginCertificate?: boolean | undefined;
    hasManufacturingCertificate?: boolean | undefined;
    hasUserManual?: boolean | undefined;
    hasCatalog?: boolean | undefined;
    hasSample?: boolean | undefined;
    warrantyDuration?: string | undefined;
    deliveryDelay?: string | undefined;
    savDuration?: string | undefined;
    interventionDelay?: string | undefined;
    savLocations?: string | undefined;
    trainingDuration?: string | undefined;
    procedureType?: "appel_offre" | "consultation" | null | undefined;
    hospitalDepositDate?: unknown;
    technicalDepartmentDepositDate?: unknown;
    supplierCommercialAudit?: string | undefined;
    lots?: {
        number: string;
        object: string;
        technicalDocuments?: {
            hasTechnicalSheet?: boolean | undefined;
            hasConformityCertificate?: boolean | undefined;
            hasOriginCertificate?: boolean | undefined;
            hasManufacturingCertificate?: boolean | undefined;
            hasUserManual?: boolean | undefined;
            hasCatalog?: boolean | undefined;
            hasSample?: boolean | undefined;
        } | undefined;
        clientRequirements?: {
            warrantyDuration?: string | undefined;
            deliveryDelay?: string | undefined;
            savDuration?: string | undefined;
            interventionDelay?: string | undefined;
            savLocations?: string | undefined;
            trainingDuration?: string | undefined;
            particularPrescriptions?: string | undefined;
        } | undefined;
    }[] | undefined;
    attachments?: {
        fileName: string;
        filePath: string;
        mimeType: string;
        fileSize: number;
        attachmentType?: string | undefined;
    }[] | undefined;
    offerTitle?: string | undefined;
    selectedTemplateId?: string | null | undefined;
    recipientIds?: string[] | undefined;
    supplierIds?: string[] | undefined;
    attachmentUrl?: string | null | undefined;
}>;
export type CreateOfferInput = z.infer<typeof createOfferSchema>;
//# sourceMappingURL=offer.validator.d.ts.map