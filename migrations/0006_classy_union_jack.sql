CREATE TABLE "offer_document_folder_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folder_id" uuid NOT NULL,
	"offer_id" uuid NOT NULL,
	"source" varchar(50) NOT NULL,
	"supplier_response_attachment_id" uuid,
	"offer_attachment_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer_document_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "distributors" ADD COLUMN "password" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "offer_document_folder_files" ADD CONSTRAINT "offer_document_folder_files_folder_id_offer_document_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."offer_document_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_document_folder_files" ADD CONSTRAINT "offer_document_folder_files_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_document_folder_files" ADD CONSTRAINT "offer_document_folder_files_supplier_response_attachment_id_supplier_response_attachments_id_fk" FOREIGN KEY ("supplier_response_attachment_id") REFERENCES "public"."supplier_response_attachments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_document_folders" ADD CONSTRAINT "offer_document_folders_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_document_folders" ADD CONSTRAINT "offer_document_folders_parent_id_offer_document_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."offer_document_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "offer_document_folder_files_folder_id_idx" ON "offer_document_folder_files" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "offer_document_folder_files_offer_id_idx" ON "offer_document_folder_files" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "offer_document_folders_offer_id_idx" ON "offer_document_folders" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "offer_document_folders_parent_id_idx" ON "offer_document_folders" USING btree ("parent_id");