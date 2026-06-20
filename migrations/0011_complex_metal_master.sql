ALTER TABLE "supplier_item_analyses" ADD COLUMN "is_selected" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "supplier_item_analyses" ADD COLUMN "selection_reason" text;