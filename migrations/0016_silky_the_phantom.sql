ALTER TYPE "public"."notification_type" ADD VALUE 'deadline_reminder';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'deadline_expired';--> statement-breakpoint
CREATE TABLE "offer_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"lot_number" varchar(20) NOT NULL,
	"lot_object" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "notification_key" varchar(255);--> statement-breakpoint
ALTER TABLE "supplier_responses" ADD COLUMN "delivery_delay" varchar(255);--> statement-breakpoint
ALTER TABLE "supplier_responses" ADD COLUMN "warranty_duration" varchar(255);--> statement-breakpoint
ALTER TABLE "supplier_responses" ADD COLUMN "after_sales_service" text;--> statement-breakpoint
ALTER TABLE "supplier_responses" ADD COLUMN "remarks" text;--> statement-breakpoint
ALTER TABLE "offer_lots" ADD CONSTRAINT "offer_lots_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "offer_lots_offer_id_idx" ON "offer_lots" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "offer_lots_number_idx" ON "offer_lots" USING btree ("lot_number");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_key_unique" ON "notifications" USING btree ("notification_key");--> statement-breakpoint
ALTER TABLE "medical_entities" DROP COLUMN "speciality";--> statement-breakpoint
ALTER TABLE "offers" DROP COLUMN "deposit_date";--> statement-breakpoint
ALTER TABLE "offers" DROP COLUMN "technical_service_date";