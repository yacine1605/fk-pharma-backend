CREATE TYPE "public"."account_type" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense');--> statement-breakpoint
CREATE TYPE "public"."bpu_status" AS ENUM('draft', 'generated', 'validated', 'signed');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."doc_type" AS ENUM('BPU', 'DGE');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'issued', 'received', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('draft', 'pending', 'sent', 'partial_failed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."po_status" AS ENUM('draft', 'submitted', 'confirmed', 'shipped', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TABLE "bpu_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"po_id" uuid,
	"doc_type" "doc_type" NOT NULL,
	"doc_number" varchar(100) NOT NULL,
	"generated_date" timestamp DEFAULT now() NOT NULL,
	"document_content" text,
	"pdf_path" varchar(255),
	"status" "bpu_status" DEFAULT 'draft' NOT NULL,
	"ai_generated_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bpu_documents_doc_number_unique" UNIQUE("doc_number")
);
--> statement-breakpoint
CREATE TABLE "chart_of_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_code" varchar(50) NOT NULL,
	"account_name" varchar(255) NOT NULL,
	"account_type" "account_type" NOT NULL,
	"description" text,
	"balance" numeric(12, 2) DEFAULT '0',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "distributors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"registration_number" varchar(100),
	"business_type" varchar(255),
	"address" text,
	"city" varchar(255),
	"postal_code" varchar(20),
	"country" varchar(255),
	"email" varchar(255),
	"website" varchar(255),
	"contact_person" varchar(255),
	"payment_terms" varchar(255),
	"credit_limit" numeric(12, 2),
	"rating" integer DEFAULT 0,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"subject_suggestion" text NOT NULL,
	"body_suggestion" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"po_id" uuid,
	"invoice_number" varchar(100) NOT NULL,
	"invoice_date" timestamp DEFAULT now() NOT NULL,
	"due_date" timestamp,
	"total_amount" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0',
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"payment_method" varchar(100),
	"payment_date" timestamp,
	"notes" text,
	"attachment_path" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entry_date" timestamp DEFAULT now() NOT NULL,
	"description" varchar(255) NOT NULL,
	"reference_type" varchar(50),
	"reference_id" varchar(100),
	"total_debits" numeric(12, 2) NOT NULL,
	"total_credits" numeric(12, 2) NOT NULL,
	"is_posted" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entry_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"debit" numeric(12, 2) DEFAULT '0',
	"credit" numeric(12, 2) DEFAULT '0',
	"description" varchar(255),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "medical_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(120) NOT NULL,
	"speciality" varchar(120) NOT NULL,
	"address" text,
	"city" varchar(120) NOT NULL,
	"phone" varchar(255),
	"email" varchar(255) NOT NULL,
	"contact_person" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) DEFAULT '' NOT NULL,
	"medical_entity_id" uuid NOT NULL,
	"selected_template_id" varchar(100),
	"email_subject" text NOT NULL,
	"email_body" text NOT NULL,
	"email_signature" text NOT NULL,
	"attachment_name" varchar(255),
	"attachment_path" text,
	"attachment_mime_type" varchar(120),
	"attachment_size" integer,
	"status" "offer_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "po_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"po_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"sku" varchar(100) NOT NULL,
	"category" varchar(255),
	"description" text,
	"unit_price" numeric(12, 2) NOT NULL,
	"unit_measure" varchar(50),
	"quantity" integer DEFAULT 0,
	"specifications" text,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"po_number" varchar(100) NOT NULL,
	"order_date" timestamp DEFAULT now() NOT NULL,
	"delivery_date" timestamp,
	"status" "po_status" DEFAULT 'draft' NOT NULL,
	"total_amount" numeric(12, 2),
	"description" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_po_number_unique" UNIQUE("po_number")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"registration_number" varchar(100),
	"business_type" varchar(255),
	"address" text,
	"city" varchar(255),
	"postal_code" varchar(20),
	"country" varchar(255),
	"email" varchar(255),
	"phone" varchar(255),
	"website" varchar(255),
	"contact_person" varchar(255),
	"payment_terms" varchar(255),
	"credit_limit" numeric(12, 2),
	"rating" integer DEFAULT 0,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255) NOT NULL,
	"company" varchar(255),
	"role" varchar(50) DEFAULT 'accountant' NOT NULL,
	"signature" varchar(255),
	"phone" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "bpu_documents" ADD CONSTRAINT "bpu_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bpu_documents" ADD CONSTRAINT "bpu_documents_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_recipients" ADD CONSTRAINT "offer_recipients_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_recipients" ADD CONSTRAINT "offer_recipients_recipient_id_suppliers_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_medical_entity_id_medical_entities_id_fk" FOREIGN KEY ("medical_entity_id") REFERENCES "public"."medical_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_line_items" ADD CONSTRAINT "po_line_items_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_line_items" ADD CONSTRAINT "po_line_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bpu_user_id" ON "bpu_documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bpu_doc_type" ON "bpu_documents" USING btree ("doc_type");--> statement-breakpoint
CREATE INDEX "idx_coa_user_id" ON "chart_of_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_coa_account_type" ON "chart_of_accounts" USING btree ("account_type");--> statement-breakpoint
CREATE INDEX "idx_distributors_is_active" ON "distributors" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_invoices_user_id" ON "invoices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_supplier_id" ON "invoices" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_status" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_journal_entries_user_id" ON "journal_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_journal_entries_entry_date" ON "journal_entries" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX "idx_journal_entry_lines_entry_id" ON "journal_entry_lines" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "idx_journal_entry_lines_account_id" ON "journal_entry_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "medical_entities_email_idx" ON "medical_entities" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "offer_recipients_offer_recipient_uidx" ON "offer_recipients" USING btree ("offer_id","recipient_id");--> statement-breakpoint
CREATE INDEX "offers_medical_entity_id_idx" ON "offers" USING btree ("medical_entity_id");--> statement-breakpoint
CREATE INDEX "idx_po_line_items_po_id" ON "po_line_items" USING btree ("po_id");--> statement-breakpoint
CREATE INDEX "idx_products_supplier_id" ON "products" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_products_sku" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "idx_po_user_id" ON "purchase_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_po_supplier_id" ON "purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_po_status" ON "purchase_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_suppliers_is_active" ON "suppliers" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");