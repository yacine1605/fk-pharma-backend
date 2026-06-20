CREATE TYPE "public"."analysis_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'needs_review');--> statement-breakpoint
CREATE TYPE "public"."attachment_type" AS ENUM('proforma', 'technical_sheet', 'catalog', 'cahier_charge', 'image', 'other');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('negative_response', 'missing_documents', 'low_conformity', 'analysis_failed', 'manual_review_required');--> statement-breakpoint
CREATE TYPE "public"."supplier_response_status" AS ENUM('pending', 'received', 'negative', 'analyzing', 'analyzed', 'needs_review', 'rejected');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "notification_type" NOT NULL,
	"offer_id" uuid,
	"supplier_id" uuid,
	"supplier_response_id" uuid,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer_excel_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"item_number" integer NOT NULL,
	"code" varchar(100),
	"name" varchar(255) NOT NULL,
	"description" text,
	"requested_quantity" integer NOT NULL,
	"technical_requirements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"min_conformity_percentage" real DEFAULT 70,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "supplier_global_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_response_id" uuid NOT NULL,
	"offer_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"technical_score" real DEFAULT 0 NOT NULL,
	"price_score" real DEFAULT 0 NOT NULL,
	"conditions_score" real DEFAULT 0 NOT NULL,
	"global_score" real DEFAULT 0 NOT NULL,
	"total_ht" numeric(14, 2),
	"total_tva" numeric(14, 2),
	"total_ttc" numeric(14, 2),
	"rank" integer,
	"is_best_supplier" boolean DEFAULT false,
	"is_eligible" boolean DEFAULT true,
	"rejection_reason" text,
	"summary" text,
	"analysis_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "supplier_item_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_response_id" uuid NOT NULL,
	"offer_item_id" uuid NOT NULL,
	"proforma_line_id" uuid,
	"status" "analysis_status" DEFAULT 'pending' NOT NULL,
	"proposed_product_name" varchar(255),
	"proposed_product_code" varchar(120),
	"proposed_brand" varchar(120),
	"quantity_requested" integer,
	"quantity_offered" integer,
	"unit_price_ht" numeric(14, 2),
	"total_ht" numeric(14, 2),
	"tva_percentage" real,
	"conformity_percentage" real DEFAULT 0 NOT NULL,
	"mandatory_missing_count" integer DEFAULT 0,
	"is_technically_compliant" boolean DEFAULT false NOT NULL,
	"analysis_details" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_summary" text,
	"ai_recommendation" text,
	"manual_override" boolean DEFAULT false,
	"manual_conformity_percentage" real,
	"manual_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "supplier_proforma_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proforma_id" uuid NOT NULL,
	"offer_item_id" uuid,
	"line_number" integer,
	"supplier_product_code" varchar(120),
	"designation" text NOT NULL,
	"brand" varchar(120),
	"quantity" integer,
	"unit_price_ht" numeric(14, 2),
	"discount_percentage" real DEFAULT 0,
	"total_ht" numeric(14, 2),
	"tva_percentage" real DEFAULT 0,
	"raw_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_proformas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_response_id" uuid NOT NULL,
	"proforma_number" varchar(120),
	"proforma_date" timestamp with time zone,
	"customer_name" varchar(255),
	"total_ht" numeric(14, 2),
	"total_tva" numeric(14, 2),
	"stamp_duty" numeric(14, 2),
	"total_ttc" numeric(14, 2),
	"currency" varchar(10) DEFAULT 'DZD',
	"payment_terms" text,
	"validity_text" text,
	"validity_days" integer,
	"extracted_json" jsonb,
	"confidence" real DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_response_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_response_id" uuid NOT NULL,
	"attachment_type" "attachment_type" DEFAULT 'other' NOT NULL,
	"original_file_name" varchar(255) NOT NULL,
	"stored_file_name" varchar(255) NOT NULL,
	"file_path" text NOT NULL,
	"mime_type" varchar(120),
	"file_size" integer,
	"page_count" integer,
	"has_text_layer" boolean DEFAULT false,
	"ocr_required" boolean DEFAULT false,
	"ocr_done" boolean DEFAULT false,
	"extracted_text" text,
	"extraction_metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"offer_supplier_id" uuid,
	"email_message_id" text,
	"email_from" varchar(255),
	"email_subject" text,
	"email_text" text,
	"status" "supplier_response_status" DEFAULT 'received' NOT NULL,
	"is_negative_response" boolean DEFAULT false NOT NULL,
	"negative_reason" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"analyzed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "email_templates" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "email_templates" CASCADE;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "do_not_recall" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "negative_response_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "last_negative_response_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_supplier_response_id_supplier_responses_id_fk" FOREIGN KEY ("supplier_response_id") REFERENCES "public"."supplier_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_excel_exports" ADD CONSTRAINT "offer_excel_exports_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_items" ADD CONSTRAINT "offer_items_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_global_analyses" ADD CONSTRAINT "supplier_global_analyses_supplier_response_id_supplier_responses_id_fk" FOREIGN KEY ("supplier_response_id") REFERENCES "public"."supplier_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_global_analyses" ADD CONSTRAINT "supplier_global_analyses_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_global_analyses" ADD CONSTRAINT "supplier_global_analyses_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_item_analyses" ADD CONSTRAINT "supplier_item_analyses_supplier_response_id_supplier_responses_id_fk" FOREIGN KEY ("supplier_response_id") REFERENCES "public"."supplier_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_item_analyses" ADD CONSTRAINT "supplier_item_analyses_offer_item_id_offer_items_id_fk" FOREIGN KEY ("offer_item_id") REFERENCES "public"."offer_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_item_analyses" ADD CONSTRAINT "supplier_item_analyses_proforma_line_id_supplier_proforma_lines_id_fk" FOREIGN KEY ("proforma_line_id") REFERENCES "public"."supplier_proforma_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_proforma_lines" ADD CONSTRAINT "supplier_proforma_lines_proforma_id_supplier_proformas_id_fk" FOREIGN KEY ("proforma_id") REFERENCES "public"."supplier_proformas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_proforma_lines" ADD CONSTRAINT "supplier_proforma_lines_offer_item_id_offer_items_id_fk" FOREIGN KEY ("offer_item_id") REFERENCES "public"."offer_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_proformas" ADD CONSTRAINT "supplier_proformas_supplier_response_id_supplier_responses_id_fk" FOREIGN KEY ("supplier_response_id") REFERENCES "public"."supplier_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_response_attachments" ADD CONSTRAINT "supplier_response_attachments_supplier_response_id_supplier_responses_id_fk" FOREIGN KEY ("supplier_response_id") REFERENCES "public"."supplier_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_responses" ADD CONSTRAINT "supplier_responses_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_responses" ADD CONSTRAINT "supplier_responses_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_responses" ADD CONSTRAINT "supplier_responses_offer_supplier_id_offer_suppliers_id_fk" FOREIGN KEY ("offer_supplier_id") REFERENCES "public"."offer_suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_offer_id_idx" ON "notifications" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "notifications_supplier_id_idx" ON "notifications" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "notifications_is_read_idx" ON "notifications" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "offer_excel_exports_offer_id_idx" ON "offer_excel_exports" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "offer_items_offer_id_idx" ON "offer_items" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "offer_items_code_idx" ON "offer_items" USING btree ("code");--> statement-breakpoint
CREATE INDEX "supplier_global_analyses_offer_id_idx" ON "supplier_global_analyses" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "supplier_global_analyses_supplier_id_idx" ON "supplier_global_analyses" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_global_analyses_global_score_idx" ON "supplier_global_analyses" USING btree ("global_score");--> statement-breakpoint
CREATE INDEX "supplier_item_analyses_response_id_idx" ON "supplier_item_analyses" USING btree ("supplier_response_id");--> statement-breakpoint
CREATE INDEX "supplier_item_analyses_offer_item_id_idx" ON "supplier_item_analyses" USING btree ("offer_item_id");--> statement-breakpoint
CREATE INDEX "supplier_proforma_lines_proforma_id_idx" ON "supplier_proforma_lines" USING btree ("proforma_id");--> statement-breakpoint
CREATE INDEX "supplier_proforma_lines_offer_item_id_idx" ON "supplier_proforma_lines" USING btree ("offer_item_id");--> statement-breakpoint
CREATE INDEX "supplier_proformas_response_id_idx" ON "supplier_proformas" USING btree ("supplier_response_id");--> statement-breakpoint
CREATE INDEX "supplier_response_attachments_response_id_idx" ON "supplier_response_attachments" USING btree ("supplier_response_id");--> statement-breakpoint
CREATE INDEX "supplier_response_attachments_type_idx" ON "supplier_response_attachments" USING btree ("attachment_type");--> statement-breakpoint
CREATE INDEX "supplier_responses_offer_id_idx" ON "supplier_responses" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "supplier_responses_supplier_id_idx" ON "supplier_responses" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_responses_status_idx" ON "supplier_responses" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_responses_email_message_uidx" ON "supplier_responses" USING btree ("email_message_id");--> statement-breakpoint
CREATE INDEX "idx_suppliers_email" ON "suppliers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_suppliers_do_not_recall" ON "suppliers" USING btree ("do_not_recall");--> statement-breakpoint
ALTER TABLE "offers" DROP COLUMN "selected_template_id";