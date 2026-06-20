CREATE TABLE "offer_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" text NOT NULL,
	"attachment_type" varchar(50) DEFAULT 'other' NOT NULL,
	"mime_type" varchar(120),
	"file_size" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "commercial_name" varchar(255);--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "consultation_number" varchar(255);--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "establishment" varchar(255);--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "wilaya" varchar(255);--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "deposit_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "deposit_location" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "lot_number" varchar(100);--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "lot_object" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "has_technical_sheet" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "has_conformity_certificate" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "has_origin_certificate" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "has_manufacturing_certificate" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "has_user_manual" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "has_catalog" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "has_sample" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "technical_service_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "warranty_duration" varchar(100);--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "delivery_delay" varchar(100);--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "sav_duration" varchar(100);--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "intervention_delay" varchar(100);--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "sav_locations" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "training_duration" varchar(100);--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "supplier_commercial_audit" text;--> statement-breakpoint
ALTER TABLE "offer_attachments" ADD CONSTRAINT "offer_attachments_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "offer_attachments_offer_id_idx" ON "offer_attachments" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "offer_attachments_type_idx" ON "offer_attachments" USING btree ("attachment_type");