-- Add inStock flag to Product to control availability
ALTER TABLE "public"."Product"
  ADD COLUMN IF NOT EXISTS "inStock" BOOLEAN NOT NULL DEFAULT TRUE;

-- Optional: index to filter available products fast
CREATE INDEX IF NOT EXISTS "Product_inStock_idx" ON "public"."Product"("inStock");

