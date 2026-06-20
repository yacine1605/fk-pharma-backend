CREATE TABLE "offer_suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"sent_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"quotation_received" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bpu_documents" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoices" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "po_line_items" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "purchase_orders" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "bpu_documents" CASCADE;--> statement-breakpoint
DROP TABLE "invoices" CASCADE;--> statement-breakpoint
DROP TABLE "po_line_items" CASCADE;--> statement-breakpoint
DROP TABLE "purchase_orders" CASCADE;--> statement-breakpoint
ALTER TABLE "offer_recipients" DROP CONSTRAINT "offer_recipients_recipient_id_suppliers_id_fk";
--> statement-breakpoint
DROP INDEX "offer_recipients_offer_recipient_uidx";--> statement-breakpoint
ALTER TABLE "offer_suppliers" ADD CONSTRAINT "offer_suppliers_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_suppliers" ADD CONSTRAINT "offer_suppliers_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "offer_suppliers_offer_supplier_uidx" ON "offer_suppliers" USING btree ("offer_id","supplier_id");--> statement-breakpoint
ALTER TABLE "offer_recipients" ADD CONSTRAINT "offer_recipients_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "offer_recipients_offer_user_uidx" ON "offer_recipients" USING btree ("offer_id","recipient_id");