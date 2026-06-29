CREATE TYPE "public"."document_verification_status" AS ENUM('pending', 'approved', 'rejected', 'needs_review');--> statement-breakpoint
CREATE TABLE "document_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_type" varchar(50) NOT NULL,
	"reference_id" uuid,
	"file_path" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime_type" varchar(120),
	"status" "document_verification_status" DEFAULT 'pending' NOT NULL,
	"is_approved" boolean DEFAULT false NOT NULL,
	"confidence" real DEFAULT 0,
	"stamp_detected" boolean DEFAULT false,
	"signature_detected" boolean DEFAULT false,
	"stamp_type" varchar(50),
	"signature_type" varchar(50),
	"document_quality" varchar(30),
	"approval_reason" text,
	"pages_analyzed" integer DEFAULT 0,
	"analysis_details" jsonb DEFAULT '{}'::jsonb,
	"verified_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "document_verifications" ADD CONSTRAINT "document_verifications_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_verifications_reference_id_idx" ON "document_verifications" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "document_verifications_status_idx" ON "document_verifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "document_verifications_document_type_idx" ON "document_verifications" USING btree ("document_type");