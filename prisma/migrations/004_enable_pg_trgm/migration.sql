-- Enable trigram similarity for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes to speed up similarity searches
CREATE INDEX IF NOT EXISTS "Product_name_trgm" ON "public"."Product" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Product_description_trgm" ON "public"."Product" USING gin ("description" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Product_instruction_trgm" ON "public"."Product" USING gin ("instruction" gin_trgm_ops);

