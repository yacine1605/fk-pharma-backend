CREATE TABLE "offer_excel_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "offer_excel_exports" ADD CONSTRAINT "offer_excel_exports_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "offer_excel_exports_offer_id_idx" ON "offer_excel_exports" USING btree ("offer_id");