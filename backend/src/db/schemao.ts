import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  decimal,
  timestamp,
  boolean,
  index,
  pgEnum,
  uniqueIndex,
  AnyPgColumn,
} from "drizzle-orm/pg-core";
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

export const offerStatusEnum = pgEnum("offer_status", [
  "draft",
  "pending",
  "sent",
  "partial_failed",
  "failed",
]);

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "pending",
  "sent",
  "failed",
]);

// Users table
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    password: varchar("password", { length: 255 }).notNull(),
    firstName: varchar("first_name", { length: 255 }).notNull(),
    lastName: varchar("last_name", { length: 255 }).notNull(),
    company: varchar("company", { length: 255 }),
    role: varchar("role", { length: 50 }).default("accountant").notNull(),
    signature: varchar("signature", { length: 255 }),
    phone: varchar("phone", { length: 20 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("idx_users_email").on(table.email)],
);

// Suppliers table
export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull().default("TEST_CHANGE"),
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
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("idx_suppliers_is_active").on(table.isActive)],
);

export const distributors = pgTable(
  "distributors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    registrationNumber: varchar("registration_number", { length: 100 }),
    businessType: varchar("business_type", { length: 255 }),
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
  },
  (table) => [index("idx_distributors_is_active").on(table.isActive)],
);

export type MedicalEntity = typeof medicalEntities.$inferSelect;
export type NewMedicalEntity = typeof medicalEntities.$inferInsert;

export const medicalEntities = pgTable(
  "medical_entities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 120 }).notNull(),
    speciality: varchar("speciality", { length: 120 }).notNull(),
    address: text("address"),
    city: varchar("city", { length: 120 }).notNull(),
    phone: varchar("phone", { length: 255 }),
    email: varchar("email", { length: 255 }).notNull(),
    contactPerson: varchar("contact_person", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("medical_entities_email_idx").on(table.email),
  }),
);

export type Offer = typeof offers.$inferSelect;
export type NewOffer = typeof offers.$inferInsert;

export const offers = pgTable(
  "offers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 255 }).notNull().default(""),
    medicalEntityId: uuid("medical_entity_id")
      .notNull()
      .references(() => medicalEntities.id, { onDelete: "cascade" }),
    selectedTemplateId: varchar("selected_template_id", { length: 100 }),
    sourceOfferId: uuid("source_offer_id").references(
      (): AnyPgColumn => offers.id,
      { onDelete: "set null" },
    ),
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
  },
  (table) => ({
    medicalEntityIdx: index("offers_medical_entity_id_idx").on(
      table.medicalEntityId,
    ),
  }),
);

export type EmailTemplate = typeof emailTemplates.$inferSelect;

export const emailTemplates = pgTable("email_templates", {
  id: varchar("id", { length: 50 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  subjectSuggestion: text("subject_suggestion").notNull(),
  bodySuggestion: text("body_suggestion").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OfferRecipient = typeof offerRecipients.$inferSelect;
export type NewOfferRecipient = typeof offerRecipients.$inferInsert;

export const offerRecipients = pgTable(
  "offer_recipients",
  {
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
  },
  (table) => ({
    uniqueRecipient: uniqueIndex("offer_recipients_offer_user_uidx").on(
      table.offerId,
      table.recipientId,
    ),
  }),
);

export const offerSuppliers = pgTable(
  "offer_suppliers",
  {
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
  },
  (table) => ({
    uniqueSupplier: uniqueIndex("offer_suppliers_offer_supplier_uidx").on(
      table.offerId,
      table.supplierId,
    ),
  }),
);

// Products table
export const products = pgTable(
  "products",
  {
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
  },
  (table) => [
    index("idx_products_supplier_id").on(table.supplierId),
    index("idx_products_sku").on(table.sku),
  ],
);

// Chart of Accounts
export const chartOfAccounts = pgTable(
  "chart_of_accounts",
  {
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
  },
  (table) => [
    index("idx_coa_user_id").on(table.userId),
    index("idx_coa_account_type").on(table.accountType),
  ],
);

// Journal Entries
export const journalEntries = pgTable(
  "journal_entries",
  {
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
  },
  (table) => [
    index("idx_journal_entries_user_id").on(table.userId),
    index("idx_journal_entries_entry_date").on(table.entryDate),
  ],
);

// Journal Entry Line Items
export const journalEntryLines = pgTable(
  "journal_entry_lines",
  {
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
  },
  (table) => [
    index("idx_journal_entry_lines_entry_id").on(table.entryId),
    index("idx_journal_entry_lines_account_id").on(table.accountId),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  chartOfAccounts: many(chartOfAccounts),
  journalEntries: many(journalEntries),
  offerRecipients: many(offerRecipients),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  products: many(products),
  offerSuppliers: many(offerSuppliers),
}));

export const medicalEntitiesRelations = relations(
  medicalEntities,
  ({ many }) => ({
    offers: many(offers),
  }),
);

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
  // FIX: offerSuppliers was missing from offersRelations
  offerSuppliers: many(offerSuppliers),
}));

export const offerRecipientsRelations = relations(
  offerRecipients,
  ({ one }) => ({
    offer: one(offers, {
      fields: [offerRecipients.offerId],
      references: [offers.id],
    }),
    recipient: one(users, {
      fields: [offerRecipients.recipientId],
      references: [users.id],
    }),
  }),
);

export const offerSuppliersRelations = relations(offerSuppliers, ({ one }) => ({
  offer: one(offers, {
    fields: [offerSuppliers.offerId],
    references: [offers.id],
  }),
  supplier: one(suppliers, {
    fields: [offerSuppliers.supplierId],
    references: [suppliers.id],
  }),
}));

export const productsRelations = relations(products, ({ one }) => ({
  // FIX: products had no relations defined
  supplier: one(suppliers, {
    fields: [products.supplierId],
    references: [suppliers.id],
  }),
}));

export const chartOfAccountsRelations = relations(
  chartOfAccounts,
  ({ one, many }) => ({
    user: one(users, {
      fields: [chartOfAccounts.userId],
      references: [users.id],
    }),
    journalEntryLines: many(journalEntryLines),
  }),
);

// FIX: journalEntries had no relations defined
export const journalEntriesRelations = relations(
  journalEntries,
  ({ one, many }) => ({
    user: one(users, {
      fields: [journalEntries.userId],
      references: [users.id],
    }),
    lines: many(journalEntryLines),
  }),
);

export const journalEntryLinesRelations = relations(
  journalEntryLines,
  ({ one }) => ({
    journalEntry: one(journalEntries, {
      fields: [journalEntryLines.entryId],
      references: [journalEntries.id],
    }),
    account: one(chartOfAccounts, {
      fields: [journalEntryLines.accountId],
      references: [chartOfAccounts.id],
    }),
  }),
);
