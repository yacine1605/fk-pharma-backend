ALTER TABLE "medical_entities" ADD COLUMN "phone2" varchar(255);--> statement-breakpoint
ALTER TABLE "offer_lots" ADD COLUMN "technical_documents" jsonb DEFAULT '{"hasTechnicalSheet":false,"hasConformityCertificate":false,"hasOriginCertificate":false,"hasManufacturingCertificate":false,"hasCatalog":false,"hasUserManual":false,"hasSample":false}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "offer_lots" ADD COLUMN "client_requirements" jsonb DEFAULT '{"particularPrescriptions":"","warrantyDuration":"","deliveryDelay":"","savDuration":"","interventionDelay":"","savLocations":"","trainingDuration":""}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "maintenance_workshop" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "available_technical_means" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "proforma_invoice" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "payment_schedule" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "discount_obtained" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "offer_expiration_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "ddp_conditions" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "site_visit_pv" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "pli_opening_pv" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "provisional_attribution_pv" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "definitive_attribution_pv" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "justice_folder" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "submission_bond" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "good_execution_bond" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "offers" DROP COLUMN "lot_number";--> statement-breakpoint
ALTER TABLE "offers" DROP COLUMN "lot_object";