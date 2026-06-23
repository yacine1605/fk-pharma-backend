import { array, boolean, object, string, z } from "zod";
const timestampSchema = z.preprocess((val) => (val === "" || val === null || val === undefined ? null : val), z.coerce.date().nullable().optional());
const lotSchema = z.object({
    number: z.string(),
    object: z.string(),
});
export const medicalEntitySchema = z.object({
    name: z.string().min(1, "Le nom est obligatoire"),
    type: z.string().min(1, "Le type est obligatoire"),
    speciality: z.string().optional().default(""), // ← FIX: optional since DB column is commented out
    address: z.string().optional(),
    city: z.string().min(1, "La ville est obligatoire"),
    phone: z.string().optional(),
    email: z.string().email("Email de l'entité invalide"),
    contactPerson: z.string().min(1, "Le contact principal est obligatoire"),
});
const attachmentSchema = z.object({
    filePath: z.string(),
    fileName: z.string(),
    mimeType: z.string(),
    fileSize: z.number(),
    attachmentType: z.string().optional().default("other"),
});
export const createOfferSchema = z.object({
    sourceOfferId: z.string().optional().nullable(),
    offerTitle: z.string().optional().default(""),
    selectedTemplateId: z.string().optional().nullable(),
    medicalEntity: medicalEntitySchema,
    emailSubject: z.string().min(1),
    emailBody: z.string().min(1),
    emailSignature: z.string().min(1),
    recipientIds: z.array(z.string()).default([]),
    supplierIds: z.array(z.string()).optional().default([]),
    attachments: z.array(attachmentSchema).optional().default([]),
    // Plan de charge
    commercialName: z.string().optional().default(""),
    consultationNumber: z.string().optional().default(""),
    establishment: z.string().optional().default(""),
    wilaya: z.string().optional().default(""),
    depositLocation: z.string().optional().default(""),
    lots: array(object({
        number: string(),
        object: string(),
        technicalDocuments: object({
            hasTechnicalSheet: boolean().default(false),
            hasConformityCertificate: boolean().default(false),
            hasOriginCertificate: boolean().default(false),
            hasManufacturingCertificate: boolean().default(false),
            hasCatalog: boolean().default(false),
            hasUserManual: boolean().default(false),
            hasSample: boolean().default(false),
        }).default({}),
        clientRequirements: object({
            particularPrescriptions: string().default(""),
            warrantyDuration: string().default(""),
            deliveryDelay: string().default(""),
            savDuration: string().default(""),
            interventionDelay: string().default(""),
            savLocations: string().default(""),
            trainingDuration: string().default(""),
        }).default({}),
    })).optional(),
    warrantyDuration: z.string().optional().default(""),
    deliveryDelay: z.string().optional().default(""),
    savDuration: z.string().optional().default(""),
    interventionDelay: z.string().optional().default(""),
    savLocations: z.string().optional().default(""),
    trainingDuration: z.string().optional().default(""),
    supplierCommercialAudit: z.string().optional().default(""),
    hasTechnicalSheet: z.boolean().optional().default(false),
    hasConformityCertificate: z.boolean().optional().default(false),
    hasOriginCertificate: z.boolean().optional().default(false),
    hasManufacturingCertificate: z.boolean().optional().default(false),
    hasUserManual: z.boolean().optional().default(false),
    hasCatalog: z.boolean().optional().default(false),
    hasSample: z.boolean().optional().default(false),
    // New fields
    procedureType: z.enum(["appel_offre", "consultation"]).optional().nullable(),
    hospitalDepositDate: timestampSchema,
    technicalDepartmentDepositDate: timestampSchema,
    // Legacy fields
    attachmentPath: z.string().optional().nullable(),
    attachmentUrl: z.string().optional().nullable(),
    attachmentName: z.string().optional().nullable(),
    attachmentSize: z.number().optional().nullable(),
    attachmentMimeType: z.string().optional().nullable(),
});
//# sourceMappingURL=offer.validator.js.map