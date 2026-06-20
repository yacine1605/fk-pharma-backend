ALTER TABLE "offer_excel_exports" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "offer_excel_exports" CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "notifications_supplier_response_id_idx" ON "notifications" USING btree ("supplier_response_id");--> statement-breakpoint
CREATE INDEX "notifications_inbox_idx" ON "notifications" USING btree ("supplier_id","is_read","created_at");