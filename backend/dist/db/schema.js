import { pgTable, uuid, text, varchar, integer, decimal, timestamp, boolean, index, pgEnum, uniqueIndex, real, jsonb, } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
// Enums
export const poStatusEnum = pgEnum("po_status", [
    "draft",
    "submitted",
    "confirmed",
    "shipped",
    "delivered",
    "cancelled",
]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
    "draft",
    "issued",
    "received",
    "paid",
    "cancelled",
]);
export const docTypeEnum = pgEnum("doc_type", ["BPU", "DGE"]);
export const bpuStatusEnum = pgEnum("bpu_status", [
    "draft",
    "generated",
    "validated",
    "signed",
]);
export const accountTypeEnum = pgEnum("account_type", [
    "asset",
    "liability",
    "equity",
    "revenue",
    "expense",
]);
export const procedureTypeEnum = pgEnum("procedure_type", [
    "appel_offre",
    "consultation",
]);
export const offerStatusEnum = pgEnum("offer_status", [
    "draft",
    "pending",
    "sent",
    "partial_failed",
    "failed",
    "completed",
]);
export const deliveryStatusEnum = pgEnum("delivery_status", [
    "pending",
    "sent",
    "failed",
]);
export const supplierResponseStatusEnum = pgEnum("supplier_response_status", [
    "pending",
    "received",
    "negative",
    "analyzing",
    "analyzed",
    "needs_review",
    "rejected",
]);
export const attachmentTypeEnum = pgEnum("attachment_type", [
    "proforma",
    "technical_sheet",
    "catalog",
    "cahier_charge",
    "image",
    "other",
    "spreadsheet",
    "document",
]);
export const analysisStatusEnum = pgEnum("analysis_status", [
    "pending",
    "processing",
    "completed",
    "failed",
    "needs_review",
]);
export const notificationTypeEnum = pgEnum("notification_type", [
    "negative_response",
    "missing_documents",
    "low_conformity",
    "analysis_failed",
    "manual_review_required",
    "deadline_reminder",
    "deadline_expired",
    "changement_statut_appel",
    "rfq_envoye",
    "fournisseur_attribue",
    "budget_depasse",
    "soumission_prete",
    "checklist_item_complete",
]);
export const tenderDocStatusEnum = pgEnum("tender_doc_status", [
    "uploaded",
    "processing",
    "extracted",
    "failed",
]);
export const documentVerificationStatusEnum = pgEnum("document_verification_status", ["pending", "approved", "rejected", "needs_review"]);
export const tenderStatusEnum = pgEnum("tender_status", [
    "brouillon",
    "publie",
    "rfq_envoye",
    "reponses_recues",
    "evalue",
    "attribue",
    "contracte",
    "annule",
]);
export const tenderTypeEnum = pgEnum("tender_type", [
    "national",
    "international",
    "restreint",
    "consultation",
]);
// Users table
export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    password: varchar("password", { length: 255 }).notNull(),
    firstName: varchar("first_name", { length: 255 }).notNull(),
    lastName: varchar("last_name", { length: 255 }).notNull(),
    company: varchar("company", { length: 255 }),
    role: varchar("role", { length: 50 }).default("agent_commercial").notNull(),
    signature: varchar("signature", { length: 255 }),
    phone: varchar("phone", { length: 20 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [index("idx_users_email").on(table.email)]);
// Suppliers table
export const suppliers = pgTable("suppliers", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    registrationNumber: varchar("registration_number", { length: 100 }),
    businessType: varchar("business_type", { length: 255 }),
    address: text("address"),
    city: varchar("city", { length: 255 }),
    postalCode: varchar("postal_code", { length: 20 }),
    country: varchar("country", { length: 255 }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 255 }),
    website: varchar("website", { length: 255 }),
    contactPerson: varchar("contact_person", { length: 255 }),
    paymentTerms: varchar("payment_terms", { length: 255 }),
    creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }),
    rating: integer("rating").default(0),
    notes: text("notes"),
    isActive: boolean("is_active").default(true),
    doNotRecall: boolean("do_not_recall").default(false),
    negativeResponseCount: integer("negative_response_count").default(0),
    lastNegativeResponseAt: timestamp("last_negative_response_at", {
        withTimezone: true,
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
    index("idx_suppliers_is_active").on(table.isActive),
    index("idx_suppliers_email").on(table.email),
    index("idx_suppliers_do_not_recall").on(table.doNotRecall),
]);
export const offerAttachments = pgTable("offer_attachments", {
    id: uuid("id").defaultRandom().primaryKey(),
    offerId: uuid("offer_id")
        .notNull()
        .references(() => offers.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: text("file_path").notNull(),
    attachmentType: varchar("attachment_type", { length: 50 })
        .notNull()
        .default("other"),
    mimeType: varchar("mime_type", { length: 120 }),
    fileSize: integer("file_size"),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (table) => [
    index("offer_attachments_offer_id_idx").on(table.offerId),
    index("offer_attachments_type_idx").on(table.attachmentType),
]);
export const offerAttachmentsRelations = relations(offerAttachments, ({ one }) => ({
    offer: one(offers, {
        fields: [offerAttachments.offerId],
        references: [offers.id],
    }),
}));
export const offerItems = pgTable("offer_items", {
    id: uuid("id").defaultRandom().primaryKey(),
    offerId: uuid("offer_id")
        .notNull()
        .references(() => offers.id, { onDelete: "cascade" }),
    itemNumber: integer("item_number").notNull(),
    code: varchar("code", { length: 100 }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    requestedQuantity: integer("requested_quantity").notNull(),
    technicalRequirements: jsonb("technical_requirements")
        .$type()
        .notNull()
        .default([]),
    minConformityPercentage: real("min_conformity_percentage").default(70),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
    index("offer_items_offer_id_idx").on(table.offerId),
    index("offer_items_code_idx").on(table.code),
]);
export const distributors = pgTable("distributors", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    registrationNumber: varchar("registration_number", { length: 100 }),
    phone: varchar("phone", { length: 255 }),
    businessType: varchar("business_type", { length: 255 }),
    password: varchar("password", { length: 255 }).notNull(),
    address: text("address"),
    city: varchar("city", { length: 255 }),
    postalCode: varchar("postal_code", { length: 20 }),
    country: varchar("country", { length: 255 }),
    email: varchar("email", { length: 255 }),
    website: varchar("website", { length: 255 }),
    contactPerson: varchar("contact_person", { length: 255 }),
    paymentTerms: varchar("payment_terms", { length: 255 }),
    creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }),
    rating: integer("rating").default(0),
    notes: text("notes"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [index("idx_distributors_is_active").on(table.isActive)]);
export const medicalEntities = pgTable("medical_entities", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 120 }).notNull(),
    address: text("address"),
    city: varchar("city", { length: 120 }).notNull(),
    phone: varchar("phone", { length: 255 }),
    phone2: varchar("phone2", { length: 255 }),
    email: varchar("email", { length: 255 }).notNull(),
    contactPerson: varchar("contact_person", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    emailIdx: index("medical_entities_email_idx").on(table.email),
}));
export const supplierResponses = pgTable("supplier_responses", {
    id: uuid("id").defaultRandom().primaryKey(),
    offerId: uuid("offer_id")
        .notNull()
        .references(() => offers.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
        .notNull()
        .references(() => suppliers.id, { onDelete: "cascade" }),
    offerSupplierId: uuid("offer_supplier_id").references(() => offerSuppliers.id, { onDelete: "set null" }),
    deliveryDelay: varchar("delivery_delay", { length: 255 }),
    warrantyDuration: varchar("warranty_duration", { length: 255 }),
    afterSalesService: text("after_sales_service"),
    remarks: text("remarks"),
    emailMessageId: text("email_message_id"),
    emailFrom: varchar("email_from", { length: 255 }),
    emailSubject: text("email_subject"),
    emailText: text("email_text"),
    status: supplierResponseStatusEnum("status").notNull().default("received"),
    isNegativeResponse: boolean("is_negative_response")
        .notNull()
        .default(false),
    negativeReason: text("negative_reason"),
    receivedAt: timestamp("received_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
    index("supplier_responses_offer_id_idx").on(table.offerId),
    index("supplier_responses_supplier_id_idx").on(table.supplierId),
    index("supplier_responses_status_idx").on(table.status),
    uniqueIndex("supplier_responses_email_message_uidx").on(table.emailMessageId),
]);
export const supplierResponseAttachments = pgTable("supplier_response_attachments", {
    id: uuid("id").defaultRandom().primaryKey(),
    supplierResponseId: uuid("supplier_response_id")
        .notNull()
        .references(() => supplierResponses.id, { onDelete: "cascade" }),
    attachmentType: attachmentTypeEnum("attachment_type")
        .notNull()
        .default("other"),
    originalFileName: varchar("original_file_name", { length: 255 }).notNull(),
    storedFileName: varchar("stored_file_name", { length: 255 }).notNull(),
    filePath: text("file_path").notNull(),
    mimeType: varchar("mime_type", { length: 120 }),
    fileSize: integer("file_size"),
    pageCount: integer("page_count"),
    hasTextLayer: boolean("has_text_layer").default(false),
    ocrRequired: boolean("ocr_required").default(false),
    ocrDone: boolean("ocr_done").default(false),
    extractedText: text("extracted_text"),
    extractionMetadata: jsonb("extraction_metadata")
        .$type()
        .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (table) => [
    index("supplier_response_attachments_response_id_idx").on(table.supplierResponseId),
    index("supplier_response_attachments_type_idx").on(table.attachmentType),
]);
export const supplierProformas = pgTable("supplier_proformas", {
    id: uuid("id").defaultRandom().primaryKey(),
    supplierResponseId: uuid("supplier_response_id")
        .notNull()
        .references(() => supplierResponses.id, { onDelete: "cascade" }),
    proformaNumber: varchar("proforma_number", { length: 120 }),
    proformaDate: timestamp("proforma_date", { withTimezone: true }),
    customerName: varchar("customer_name", { length: 255 }),
    totalHT: decimal("total_ht", { precision: 14, scale: 2 }),
    totalTVA: decimal("total_tva", { precision: 14, scale: 2 }),
    stampDuty: decimal("stamp_duty", { precision: 14, scale: 2 }),
    totalTTC: decimal("total_ttc", { precision: 14, scale: 2 }),
    currency: varchar("currency", { length: 10 }).default("DZD"),
    paymentTerms: text("payment_terms"),
    validityText: text("validity_text"),
    validityDays: integer("validity_days"),
    extractedJson: jsonb("extracted_json").$type(),
    confidence: real("confidence").default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (table) => [
    index("supplier_proformas_response_id_idx").on(table.supplierResponseId),
]);
export const supplierProformaLines = pgTable("supplier_proforma_lines", {
    id: uuid("id").defaultRandom().primaryKey(),
    proformaId: uuid("proforma_id")
        .notNull()
        .references(() => supplierProformas.id, { onDelete: "cascade" }),
    offerItemId: uuid("offer_item_id").references(() => offerItems.id, {
        onDelete: "set null",
    }),
    lineNumber: integer("line_number"),
    supplierProductCode: varchar("supplier_product_code", { length: 120 }),
    designation: text("designation").notNull(),
    brand: varchar("brand", { length: 120 }),
    quantity: integer("quantity"),
    unitPriceHT: decimal("unit_price_ht", { precision: 14, scale: 2 }),
    discountPercentage: real("discount_percentage").default(0),
    totalHT: decimal("total_ht", { precision: 14, scale: 2 }),
    tvaPercentage: real("tva_percentage").default(0),
    rawText: text("raw_text"),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (table) => [
    index("supplier_proforma_lines_proforma_id_idx").on(table.proformaId),
    index("supplier_proforma_lines_offer_item_id_idx").on(table.offerItemId),
]);
export const supplierItemAnalyses = pgTable("supplier_item_analyses", {
    id: uuid("id").defaultRandom().primaryKey(),
    supplierResponseId: uuid("supplier_response_id")
        .notNull()
        .references(() => supplierResponses.id, { onDelete: "cascade" }),
    offerItemId: uuid("offer_item_id")
        .notNull()
        .references(() => offerItems.id, { onDelete: "cascade" }),
    proformaLineId: uuid("proforma_line_id").references(() => supplierProformaLines.id, { onDelete: "set null" }),
    status: analysisStatusEnum("status").notNull().default("pending"),
    proposedProductName: varchar("proposed_product_name", { length: 255 }),
    proposedProductCode: varchar("proposed_product_code", { length: 120 }),
    proposedBrand: varchar("proposed_brand", { length: 120 }),
    quantityRequested: integer("quantity_requested"),
    quantityOffered: integer("quantity_offered"),
    unitPriceHT: decimal("unit_price_ht", { precision: 14, scale: 2 }),
    totalHT: decimal("total_ht", { precision: 14, scale: 2 }),
    tvaPercentage: real("tva_percentage"),
    conformityPercentage: real("conformity_percentage").notNull().default(0),
    mandatoryMissingCount: integer("mandatory_missing_count").default(0),
    isTechnicallyCompliant: boolean("is_technically_compliant")
        .notNull()
        .default(false),
    analysisDetails: jsonb("analysis_details")
        .$type()
        .notNull()
        .default([]),
    aiSummary: text("ai_summary"),
    aiRecommendation: text("ai_recommendation"),
    isSelected: boolean("is_selected").default(false),
    selectionReason: text("selection_reason"),
    manualOverride: boolean("manual_override").default(false),
    manualConformityPercentage: real("manual_conformity_percentage"),
    manualComment: text("manual_comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
    index("supplier_item_analyses_response_id_idx").on(table.supplierResponseId),
    index("supplier_item_analyses_offer_item_id_idx").on(table.offerItemId),
]);
export const supplierGlobalAnalyses = pgTable("supplier_global_analyses", {
    id: uuid("id").defaultRandom().primaryKey(),
    supplierResponseId: uuid("supplier_response_id")
        .notNull()
        .references(() => supplierResponses.id, { onDelete: "cascade" }),
    offerId: uuid("offer_id")
        .notNull()
        .references(() => offers.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
        .notNull()
        .references(() => suppliers.id, { onDelete: "cascade" }),
    technicalScore: real("technical_score").notNull().default(0),
    priceScore: real("price_score").notNull().default(0),
    conditionsScore: real("conditions_score").notNull().default(0),
    globalScore: real("global_score").notNull().default(0),
    totalHT: decimal("total_ht", { precision: 14, scale: 2 }),
    totalTVA: decimal("total_tva", { precision: 14, scale: 2 }),
    totalTTC: decimal("total_ttc", { precision: 14, scale: 2 }),
    rank: integer("rank"),
    isBestSupplier: boolean("is_best_supplier").default(false),
    isEligible: boolean("is_eligible").default(true),
    rejectionReason: text("rejection_reason"),
    summary: text("summary"),
    analysisJson: jsonb("analysis_json").$type(),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
    index("supplier_global_analyses_offer_id_idx").on(table.offerId),
    index("supplier_global_analyses_supplier_id_idx").on(table.supplierId),
    index("supplier_global_analyses_global_score_idx").on(table.globalScore),
]);
export const notifications = pgTable("notifications", {
    id: uuid("id").defaultRandom().primaryKey(),
    type: notificationTypeEnum("type").notNull(),
    offerId: uuid("offer_id").references(() => offers.id, {
        onDelete: "cascade",
    }),
    supplierId: uuid("supplier_id").references(() => suppliers.id, {
        onDelete: "cascade",
    }),
    supplierResponseId: uuid("supplier_response_id").references(() => supplierResponses.id, { onDelete: "cascade" }),
    notificationKey: varchar("notification_key", { length: 255 }),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (table) => [
    index("notifications_offer_id_idx").on(table.offerId),
    index("notifications_supplier_id_idx").on(table.supplierId),
    index("notifications_is_read_idx").on(table.isRead),
    index("notifications_supplier_response_id_idx").on(table.supplierResponseId),
    index("notifications_inbox_idx").on(table.supplierId, table.isRead, table.createdAt),
    uniqueIndex("notifications_key_unique").on(table.notificationKey),
]);
export const offerDeadlines = pgTable("offer_deadlines", {
    id: uuid("id").defaultRandom().primaryKey(),
    offerId: uuid("offer_id")
        .notNull()
        .references(() => offers.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 80 }).notNull(),
    date: timestamp("date", { withTimezone: true }).notNull(),
    notifyBeforeDays: integer("notify_before_days").default(3),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
export const offerFinalSelections = pgTable("offer_final_selections", {
    id: uuid("id").defaultRandom().primaryKey(),
    offerId: uuid("offer_id")
        .notNull()
        .references(() => offers.id, { onDelete: "cascade" }),
    offerItemId: uuid("offer_item_id")
        .notNull()
        .references(() => offerItems.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
        .notNull()
        .references(() => suppliers.id, { onDelete: "cascade" }),
    supplierResponseId: uuid("supplier_response_id").references(() => supplierResponses.id, { onDelete: "set null" }),
    supplierItemAnalysisId: uuid("supplier_item_analysis_id").references(() => supplierItemAnalyses.id, { onDelete: "set null" }),
    selectedBy: uuid("selected_by").references(() => users.id, {
        onDelete: "set null",
    }),
    reason: text("reason"),
    remarks: text("remarks"),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
export const offers = pgTable("offers", {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 255 }).notNull().default(""),
    medicalEntityId: uuid("medical_entity_id")
        .notNull()
        .references(() => medicalEntities.id, { onDelete: "cascade" }),
    sourceOfferId: uuid("source_offer_id").references(() => offers.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, {
        onDelete: "set null",
    }),
    emailSubject: text("email_subject").notNull(),
    emailBody: text("email_body").notNull(),
    emailSignature: text("email_signature").notNull(),
    attachmentName: varchar("attachment_name", { length: 255 }),
    attachmentPath: text("attachment_path"),
    attachmentMimeType: varchar("attachment_mime_type", { length: 120 }),
    attachmentSize: integer("attachment_size"),
    status: offerStatusEnum("status").notNull().default("pending"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
    // ── En-tête ──
    commercialName: varchar("commercial_name", { length: 255 }),
    consultationNumber: varchar("consultation_number", { length: 255 }),
    establishment: varchar("establishment", { length: 255 }),
    wilaya: varchar("wilaya", { length: 255 }),
    depositLocation: text("deposit_location"),
    // ── Documents (cases à cocher + fichiers joints via offerAttachments) ──
    hasTechnicalSheet: boolean("has_technical_sheet").default(false),
    hasConformityCertificate: boolean("has_conformity_certificate").default(false),
    hasOriginCertificate: boolean("has_origin_certificate").default(false),
    hasManufacturingCertificate: boolean("has_manufacturing_certificate").default(false),
    hasUserManual: boolean("has_user_manual").default(false),
    hasCatalog: boolean("has_catalog").default(false),
    hasSample: boolean("has_sample").default(false),
    // ── Prescriptions tableau ──
    warrantyDuration: varchar("warranty_duration", { length: 100 }),
    deliveryDelay: varchar("delivery_delay", { length: 100 }),
    savDuration: varchar("sav_duration", { length: 100 }),
    interventionDelay: varchar("intervention_delay", { length: 100 }),
    savLocations: text("sav_locations"),
    trainingDuration: varchar("training_duration", { length: 100 }),
    procedureType: procedureTypeEnum("procedure_type"),
    hospitalDepositDate: timestamp("hospital_deposit_date", {
        withTimezone: true,
    }),
    technicalDepartmentDepositDate: timestamp("technical_department_deposit_date", {
        withTimezone: true,
    }),
    // ── Suivi commercial / Dossier ──
    maintenanceWorkshop: text("maintenance_workshop"),
    availableTechnicalMeans: text("available_technical_means"),
    proformaInvoice: text("proforma_invoice"),
    paymentSchedule: text("payment_schedule"),
    discountObtained: text("discount_obtained"),
    offerExpirationDate: timestamp("offer_expiration_date", {
        withTimezone: true,
    }),
    ddpConditions: text("ddp_conditions"),
    // ── Suivi du Dossier (PVs & Cautions) ──
    siteVisitPV: boolean("site_visit_pv").default(false),
    pliOpeningPV: boolean("pli_opening_pv").default(false),
    provisionalAttributionPV: boolean("provisional_attribution_pv").default(false),
    definitiveAttributionPV: boolean("definitive_attribution_pv").default(false),
    justiceFolder: boolean("justice_folder").default(false),
    submissionBond: boolean("submission_bond").default(false),
    goodExecutionBond: boolean("good_execution_bond").default(false),
    // ── Audit commercial ──
    supplierCommercialAudit: text("supplier_commercial_audit"),
    // ── Tender lifecycle (state machine) ──
    tenderStatus: tenderStatusEnum("tender_status").default("brouillon"),
    tenderType: tenderTypeEnum("tender_type"),
    tenderReference: varchar("tender_reference", { length: 255 }),
    tenderPublishedAt: timestamp("tender_published_at", { withTimezone: true }),
    tenderAwardedAt: timestamp("tender_awarded_at", { withTimezone: true }),
    estimatedBudget: decimal("estimated_budget", { precision: 14, scale: 2 }),
}, (table) => ({
    medicalEntityIdx: index("offers_medical_entity_id_idx").on(table.medicalEntityId),
}));
export const supplierCategories = pgTable("supplier_categories", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
});
export const supplierCategoryLinks = pgTable("supplier_category_links", {
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    categoryId: uuid("category_id").references(() => supplierCategories.id),
});
export const offerRecipients = pgTable("offer_recipients", {
    id: uuid("id").defaultRandom().primaryKey(),
    offerId: uuid("offer_id")
        .notNull()
        .references(() => offers.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    status: deliveryStatusEnum("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (table) => ({
    uniqueRecipient: uniqueIndex("offer_recipients_offer_user_uidx").on(table.offerId, table.recipientId),
}));
export const offerSuppliers = pgTable("offer_suppliers", {
    id: uuid("id").defaultRandom().primaryKey(),
    offerId: uuid("offer_id")
        .notNull()
        .references(() => offers.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
        .notNull()
        .references(() => suppliers.id, { onDelete: "cascade" }),
    status: deliveryStatusEnum("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    quotationReceived: boolean("quotation_received").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (table) => ({
    uniqueSupplier: uniqueIndex("offer_suppliers_offer_supplier_uidx").on(table.offerId, table.supplierId),
}));
// Products table
export const products = pgTable("products", {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id")
        .notNull()
        .references(() => suppliers.id),
    name: varchar("name", { length: 255 }).notNull(),
    sku: varchar("sku", { length: 100 }).notNull(),
    category: varchar("category", { length: 255 }),
    description: text("description"),
    unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
    unitMeasure: varchar("unit_measure", { length: 50 }),
    quantity: integer("quantity").default(0),
    specifications: text("specifications"),
    notes: text("notes"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
    index("idx_products_supplier_id").on(table.supplierId),
    index("idx_products_sku").on(table.sku),
]);
// Chart of Accounts
export const chartOfAccounts = pgTable("chart_of_accounts", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id),
    accountCode: varchar("account_code", { length: 50 }).notNull(),
    accountName: varchar("account_name", { length: 255 }).notNull(),
    accountType: accountTypeEnum("account_type").notNull(),
    description: text("description"),
    balance: decimal("balance", { precision: 12, scale: 2 }).default("0"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
    index("idx_coa_user_id").on(table.userId),
    index("idx_coa_account_type").on(table.accountType),
]);
// Journal Entries
export const journalEntries = pgTable("journal_entries", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id),
    entryDate: timestamp("entry_date").defaultNow().notNull(),
    description: varchar("description", { length: 255 }).notNull(),
    referenceType: varchar("reference_type", { length: 50 }),
    referenceId: varchar("reference_id", { length: 100 }),
    totalDebits: decimal("total_debits", { precision: 12, scale: 2 }).notNull(),
    totalCredits: decimal("total_credits", {
        precision: 12,
        scale: 2,
    }).notNull(),
    isPosted: boolean("is_posted").default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
    index("idx_journal_entries_user_id").on(table.userId),
    index("idx_journal_entries_entry_date").on(table.entryDate),
]);
// Journal Entry Line Items
export const journalEntryLines = pgTable("journal_entry_lines", {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
        .notNull()
        .references(() => journalEntries.id),
    accountId: uuid("account_id")
        .notNull()
        .references(() => chartOfAccounts.id),
    debit: decimal("debit", { precision: 12, scale: 2 }).default("0"),
    credit: decimal("credit", { precision: 12, scale: 2 }).default("0"),
    description: varchar("description", { length: 255 }),
    notes: text("notes"),
}, (table) => [
    index("idx_journal_entry_lines_entry_id").on(table.entryId),
    index("idx_journal_entry_lines_account_id").on(table.accountId),
]);
// ─── Relations ────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
    chartOfAccounts: many(chartOfAccounts),
    journalEntries: many(journalEntries),
    offerRecipients: many(offerRecipients),
    finalSelections: many(offerFinalSelections),
}));
export const medicalEntitiesRelations = relations(medicalEntities, ({ many }) => ({
    offers: many(offers),
}));
export const offersRelations = relations(offers, ({ one, many }) => ({
    medicalEntity: one(medicalEntities, {
        fields: [offers.medicalEntityId],
        references: [medicalEntities.id],
    }),
    sourceOffer: one(offers, {
        fields: [offers.sourceOfferId],
        references: [offers.id],
        relationName: "offerToSource",
    }),
    offerRecipients: many(offerRecipients),
    offerSuppliers: many(offerSuppliers),
    offerItems: many(offerItems),
    supplierResponses: many(supplierResponses),
    globalAnalyses: many(supplierGlobalAnalyses),
    excelExports: many(offerExcelExports),
    offerAttachments: many(offerAttachments),
    lots: many(offerLots),
    deadlines: many(offerDeadlines),
    finalSelections: many(offerFinalSelections),
    documentFolders: many(offerDocumentFolders),
    tenderDocuments: many(tenderDocuments),
    tenderAuditLog: many(tenderAuditLog),
    tenderChecklist: many(tenderChecklist),
}));
export const offerItemsRelations = relations(offerItems, ({ one, many }) => ({
    offer: one(offers, {
        fields: [offerItems.offerId],
        references: [offers.id],
    }),
    itemAnalyses: many(supplierItemAnalyses),
    finalSelections: many(offerFinalSelections),
}));
export const suppliersRelations = relations(suppliers, ({ many }) => ({
    products: many(products),
    offerSuppliers: many(offerSuppliers),
    categoryLinks: many(supplierCategoryLinks),
    finalSelections: many(offerFinalSelections),
}));
export const supplierResponsesRelations = relations(supplierResponses, ({ one, many }) => ({
    offer: one(offers, {
        fields: [supplierResponses.offerId],
        references: [offers.id],
    }),
    supplier: one(suppliers, {
        fields: [supplierResponses.supplierId],
        references: [suppliers.id],
    }),
    offerSupplier: one(offerSuppliers, {
        fields: [supplierResponses.offerSupplierId],
        references: [offerSuppliers.id],
    }),
    attachments: many(supplierResponseAttachments),
    proformas: many(supplierProformas),
    itemAnalyses: many(supplierItemAnalyses),
    globalAnalyses: many(supplierGlobalAnalyses),
}));
export const supplierResponseAttachmentsRelations = relations(supplierResponseAttachments, ({ one, many }) => ({
    supplierResponse: one(supplierResponses, {
        fields: [supplierResponseAttachments.supplierResponseId],
        references: [supplierResponses.id],
    }),
    folderFiles: many(offerDocumentFolderFiles),
}));
export const supplierProformasRelations = relations(supplierProformas, ({ one, many }) => ({
    supplierResponse: one(supplierResponses, {
        fields: [supplierProformas.supplierResponseId],
        references: [supplierResponses.id],
    }),
    lines: many(supplierProformaLines),
}));
export const supplierProformaLinesRelations = relations(supplierProformaLines, ({ one }) => ({
    proforma: one(supplierProformas, {
        fields: [supplierProformaLines.proformaId],
        references: [supplierProformas.id],
    }),
    offerItem: one(offerItems, {
        fields: [supplierProformaLines.offerItemId],
        references: [offerItems.id],
    }),
}));
export const supplierItemAnalysesRelations = relations(supplierItemAnalyses, ({ one }) => ({
    supplierResponse: one(supplierResponses, {
        fields: [supplierItemAnalyses.supplierResponseId],
        references: [supplierResponses.id],
    }),
    offerItem: one(offerItems, {
        fields: [supplierItemAnalyses.offerItemId],
        references: [offerItems.id],
    }),
    proformaLine: one(supplierProformaLines, {
        fields: [supplierItemAnalyses.proformaLineId],
        references: [supplierProformaLines.id],
    }),
}));
export const supplierGlobalAnalysesRelations = relations(supplierGlobalAnalyses, ({ one }) => ({
    supplierResponse: one(supplierResponses, {
        fields: [supplierGlobalAnalyses.supplierResponseId],
        references: [supplierResponses.id],
    }),
    offer: one(offers, {
        fields: [supplierGlobalAnalyses.offerId],
        references: [offers.id],
    }),
    supplier: one(suppliers, {
        fields: [supplierGlobalAnalyses.supplierId],
        references: [suppliers.id],
    }),
}));
export const notificationsRelations = relations(notifications, ({ one }) => ({
    offer: one(offers, {
        fields: [notifications.offerId],
        references: [offers.id],
    }),
    supplier: one(suppliers, {
        fields: [notifications.supplierId],
        references: [suppliers.id],
    }),
    supplierResponse: one(supplierResponses, {
        fields: [notifications.supplierResponseId],
        references: [supplierResponses.id],
    }),
}));
export const offerRecipientsRelations = relations(offerRecipients, ({ one }) => ({
    offer: one(offers, {
        fields: [offerRecipients.offerId],
        references: [offers.id],
    }),
    recipient: one(users, {
        fields: [offerRecipients.recipientId],
        references: [users.id],
    }),
}));
export const offerLots = pgTable("offer_lots", {
    id: uuid("id").defaultRandom().primaryKey(),
    offerId: uuid("offer_id")
        .notNull()
        .references(() => offers.id, {
        onDelete: "cascade",
    }),
    lotNumber: varchar("lot_number", {
        length: 20,
    }).notNull(),
    lotObject: text("lot_object").notNull(),
    technicalDocuments: jsonb("technical_documents")
        .$type()
        .notNull()
        .default({
        hasTechnicalSheet: false,
        hasConformityCertificate: false,
        hasOriginCertificate: false,
        hasManufacturingCertificate: false,
        hasCatalog: false,
        hasUserManual: false,
        hasSample: false,
    }),
    clientRequirements: jsonb("client_requirements")
        .$type()
        .notNull()
        .default({
        particularPrescriptions: "",
        warrantyDuration: "",
        deliveryDelay: "",
        savDuration: "",
        interventionDelay: "",
        savLocations: "",
        trainingDuration: "",
    }),
}, (table) => [
    index("offer_lots_offer_id_idx").on(table.offerId),
    index("offer_lots_number_idx").on(table.lotNumber),
]);
export const offerSuppliersRelations = relations(offerSuppliers, ({ one, many }) => ({
    offer: one(offers, {
        fields: [offerSuppliers.offerId],
        references: [offers.id],
    }),
    supplier: one(suppliers, {
        fields: [offerSuppliers.supplierId],
        references: [suppliers.id],
    }),
    responses: many(supplierResponses),
}));
export const productsRelations = relations(products, ({ one }) => ({
    supplier: one(suppliers, {
        fields: [products.supplierId],
        references: [suppliers.id],
    }),
}));
export const offerLotsRelations = relations(offerLots, ({ one }) => ({
    offer: one(offers, {
        fields: [offerLots.offerId],
        references: [offers.id],
    }),
}));
export const chartOfAccountsRelations = relations(chartOfAccounts, ({ one, many }) => ({
    user: one(users, {
        fields: [chartOfAccounts.userId],
        references: [users.id],
    }),
    journalEntryLines: many(journalEntryLines),
}));
export const journalEntriesRelations = relations(journalEntries, ({ one, many }) => ({
    user: one(users, {
        fields: [journalEntries.userId],
        references: [users.id],
    }),
    lines: many(journalEntryLines),
}));
export const journalEntryLinesRelations = relations(journalEntryLines, ({ one }) => ({
    journalEntry: one(journalEntries, {
        fields: [journalEntryLines.entryId],
        references: [journalEntries.id],
    }),
    account: one(chartOfAccounts, {
        fields: [journalEntryLines.accountId],
        references: [chartOfAccounts.id],
    }),
}));
export const offerExcelExports = pgTable("offer_excel_exports", {
    id: uuid("id").defaultRandom().primaryKey(),
    offerId: uuid("offer_id")
        .notNull()
        .references(() => offers.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: text("file_path").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (table) => [index("offer_excel_exports_offer_id_idx").on(table.offerId)]);
export const offerDocumentFolderFiles = pgTable("offer_document_folder_files", {
    id: uuid("id").defaultRandom().primaryKey(),
    folderId: uuid("folder_id")
        .notNull()
        .references(() => offerDocumentFolders.id, { onDelete: "cascade" }),
    offerId: uuid("offer_id")
        .notNull()
        .references(() => offers.id, { onDelete: "cascade" }),
    source: varchar("source", { length: 50 }).notNull(),
    supplierResponseAttachmentId: uuid("supplier_response_attachment_id").references(() => supplierResponseAttachments.id, {
        onDelete: "cascade",
    }),
    offerAttachmentPath: text("offer_attachment_path"),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (table) => [
    index("offer_document_folder_files_folder_id_idx").on(table.folderId),
    index("offer_document_folder_files_offer_id_idx").on(table.offerId),
]);
export const offerDocumentFolders = pgTable("offer_document_folders", {
    id: uuid("id").defaultRandom().primaryKey(),
    offerId: uuid("offer_id")
        .notNull()
        .references(() => offers.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    parentId: uuid("parent_id").references(() => offerDocumentFolders.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (table) => [
    index("offer_document_folders_offer_id_idx").on(table.offerId),
    index("offer_document_folders_parent_id_idx").on(table.parentId),
]);
// ─── Tender Documents (Cahier des charges uploads) ────────────────────────────
export const tenderDocuments = pgTable("tender_documents", {
    id: uuid("id").defaultRandom().primaryKey(),
    offerId: uuid("offer_id")
        .notNull()
        .references(() => offers.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: text("file_path").notNull(),
    mimeType: varchar("mime_type", { length: 120 }),
    fileSize: integer("file_size"),
    status: tenderDocStatusEnum("status").notNull().default("uploaded"),
    extractedText: text("extracted_text"),
    extractedJson: jsonb("extracted_json")
        .$type()
        .default({}),
    pageCount: integer("page_count"),
    ocrRequired: boolean("ocr_required").default(false),
    ocrDone: boolean("ocr_done").default(false),
    confidence: real("confidence").default(0),
    errorMessage: text("error_message"),
    uploadedBy: uuid("uploaded_by").references(() => users.id, {
        onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
    index("tender_documents_offer_id_idx").on(table.offerId),
    index("tender_documents_status_idx").on(table.status),
]);
// ─── Tender Audit Log ─────────────────────────────────────────────────────────
export const tenderAuditLog = pgTable("tender_audit_log", {
    id: uuid("id").defaultRandom().primaryKey(),
    offerId: uuid("offer_id")
        .notNull()
        .references(() => offers.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
        onDelete: "set null",
    }),
    fromStatus: varchar("from_status", { length: 80 }),
    toStatus: varchar("to_status", { length: 80 }).notNull(),
    action: varchar("action", { length: 255 }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (table) => [
    index("tender_audit_log_offer_id_idx").on(table.offerId),
    index("tender_audit_log_created_at_idx").on(table.createdAt),
]);
// ─── Tender Checklist ────────────────────────────────────────────────────────
export const tenderChecklist = pgTable("tender_checklist", {
    id: uuid("id").defaultRandom().primaryKey(),
    offerId: uuid("offer_id")
        .notNull()
        .references(() => offers.id, { onDelete: "cascade" }),
    checklistItem: text("checklist_item").notNull(),
    category: varchar("category", { length: 120 }).notNull().default("général"),
    isRequired: boolean("is_required").notNull().default(true),
    isCompleted: boolean("is_completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: uuid("completed_by").references(() => users.id, {
        onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (table) => [
    index("tender_checklist_offer_id_idx").on(table.offerId),
    index("tender_checklist_completed_idx").on(table.isCompleted),
]);
export const offerExcelExportsRelations = relations(offerExcelExports, ({ one }) => ({
    offer: one(offers, {
        fields: [offerExcelExports.offerId],
        references: [offers.id],
    }),
}));
export const tenderDocumentsRelations = relations(tenderDocuments, ({ one }) => ({
    offer: one(offers, {
        fields: [tenderDocuments.offerId],
        references: [offers.id],
    }),
    uploadedBy: one(users, {
        fields: [tenderDocuments.uploadedBy],
        references: [users.id],
    }),
}));
export const tenderAuditLogRelations = relations(tenderAuditLog, ({ one }) => ({
    offer: one(offers, {
        fields: [tenderAuditLog.offerId],
        references: [offers.id],
    }),
    user: one(users, {
        fields: [tenderAuditLog.userId],
        references: [users.id],
    }),
}));
export const tenderChecklistRelations = relations(tenderChecklist, ({ one }) => ({
    offer: one(offers, {
        fields: [tenderChecklist.offerId],
        references: [offers.id],
    }),
    completedByUser: one(users, {
        fields: [tenderChecklist.completedBy],
        references: [users.id],
    }),
}));
// ─── Document Verifications (AI stamp/signature analysis results) ─────────────
export const documentVerifications = pgTable("document_verifications", {
    id: uuid("id").defaultRandom().primaryKey(),
    documentType: varchar("document_type", { length: 50 }).notNull(),
    referenceId: uuid("reference_id"),
    filePath: text("file_path").notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 120 }),
    status: documentVerificationStatusEnum("status")
        .notNull()
        .default("pending"),
    isApproved: boolean("is_approved").notNull().default(false),
    confidence: real("confidence").default(0),
    stampDetected: boolean("stamp_detected").default(false),
    signatureDetected: boolean("signature_detected").default(false),
    stampType: varchar("stamp_type", { length: 50 }),
    signatureType: varchar("signature_type", { length: 50 }),
    documentQuality: varchar("document_quality", { length: 30 }),
    approvalReason: text("approval_reason"),
    pagesAnalyzed: integer("pages_analyzed").default(0),
    analysisDetails: jsonb("analysis_details")
        .$type()
        .default({}),
    verifiedBy: uuid("verified_by").references(() => users.id, {
        onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
    index("document_verifications_reference_id_idx").on(table.referenceId),
    index("document_verifications_status_idx").on(table.status),
    index("document_verifications_document_type_idx").on(table.documentType),
]);
export const documentVerificationsRelations = relations(documentVerifications, ({ one }) => ({
    verifiedByUser: one(users, {
        fields: [documentVerifications.verifiedBy],
        references: [users.id],
    }),
}));
export const offerDeadlinesRelations = relations(offerDeadlines, ({ one }) => ({
    offer: one(offers, {
        fields: [offerDeadlines.offerId],
        references: [offers.id],
    }),
}));
export const offerFinalSelectionsRelations = relations(offerFinalSelections, ({ one }) => ({
    offer: one(offers, {
        fields: [offerFinalSelections.offerId],
        references: [offers.id],
    }),
    offerItem: one(offerItems, {
        fields: [offerFinalSelections.offerItemId],
        references: [offerItems.id],
    }),
    supplier: one(suppliers, {
        fields: [offerFinalSelections.supplierId],
        references: [suppliers.id],
    }),
    supplierResponse: one(supplierResponses, {
        fields: [offerFinalSelections.supplierResponseId],
        references: [supplierResponses.id],
    }),
    supplierItemAnalysis: one(supplierItemAnalyses, {
        fields: [offerFinalSelections.supplierItemAnalysisId],
        references: [supplierItemAnalyses.id],
    }),
    selectedBy: one(users, {
        fields: [offerFinalSelections.selectedBy],
        references: [users.id],
    }),
}));
export const supplierCategoriesRelations = relations(supplierCategories, ({ many }) => ({
    categoryLinks: many(supplierCategoryLinks),
}));
export const supplierCategoryLinksRelations = relations(supplierCategoryLinks, ({ one }) => ({
    supplier: one(suppliers, {
        fields: [supplierCategoryLinks.supplierId],
        references: [suppliers.id],
    }),
    category: one(supplierCategories, {
        fields: [supplierCategoryLinks.categoryId],
        references: [supplierCategories.id],
    }),
}));
export const distributorsRelations = relations(distributors, ({ many }) => ({
// No FK references exist yet — placeholder for future links.
}));
export const offerDocumentFoldersRelations = relations(offerDocumentFolders, ({ one, many }) => ({
    offer: one(offers, {
        fields: [offerDocumentFolders.offerId],
        references: [offers.id],
    }),
    parent: one(offerDocumentFolders, {
        fields: [offerDocumentFolders.parentId],
        references: [offerDocumentFolders.id],
        relationName: "folderToParent",
    }),
    children: many(offerDocumentFolders, {
        relationName: "folderToParent",
    }),
    files: many(offerDocumentFolderFiles),
}));
export const offerDocumentFolderFilesRelations = relations(offerDocumentFolderFiles, ({ one }) => ({
    folder: one(offerDocumentFolders, {
        fields: [offerDocumentFolderFiles.folderId],
        references: [offerDocumentFolders.id],
    }),
    offer: one(offers, {
        fields: [offerDocumentFolderFiles.offerId],
        references: [offers.id],
    }),
    supplierResponseAttachment: one(supplierResponseAttachments, {
        fields: [offerDocumentFolderFiles.supplierResponseAttachmentId],
        references: [supplierResponseAttachments.id],
    }),
}));
//# sourceMappingURL=schema.js.map