CREATE TYPE "public"."procedure_type" AS ENUM('appel_offre', 'consultation');--> statement-breakpoint
CREATE TABLE "offer_deadlines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"type" varchar(80) NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"notify_before_days" integer DEFAULT 3,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer_final_selections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"offer_item_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"supplier_response_id" uuid,
	"supplier_item_analysis_id" uuid,
	"selected_by" uuid,
	"reason" text,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_category_links" (
	"supplier_id" uuid,
	"category_id" uuid
);
--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "procedure_type" "procedure_type";--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "hospital_deposit_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "technical_department_deposit_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "offer_deadlines" ADD CONSTRAINT "offer_deadlines_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_final_selections" ADD CONSTRAINT "offer_final_selections_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_final_selections" ADD CONSTRAINT "offer_final_selections_offer_item_id_offer_items_id_fk" FOREIGN KEY ("offer_item_id") REFERENCES "public"."offer_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_final_selections" ADD CONSTRAINT "offer_final_selections_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_final_selections" ADD CONSTRAINT "offer_final_selections_supplier_response_id_supplier_responses_id_fk" FOREIGN KEY ("supplier_response_id") REFERENCES "public"."supplier_responses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_final_selections" ADD CONSTRAINT "offer_final_selections_supplier_item_analysis_id_supplier_item_analyses_id_fk" FOREIGN KEY ("supplier_item_analysis_id") REFERENCES "public"."supplier_item_analyses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_final_selections" ADD CONSTRAINT "offer_final_selections_selected_by_users_id_fk" FOREIGN KEY ("selected_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_category_links" ADD CONSTRAINT "supplier_category_links_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_category_links" ADD CONSTRAINT "supplier_category_links_category_id_supplier_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."supplier_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;