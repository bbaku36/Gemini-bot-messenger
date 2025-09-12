-- Add contact fields to User
ALTER TABLE "public"."User"
  ADD COLUMN IF NOT EXISTS "contactPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "address" TEXT;

-- Create OrderItem table
CREATE TABLE IF NOT EXISTS "public"."OrderItem" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "orderId" TEXT NOT NULL,
  "productId" TEXT,
  "productName" TEXT NOT NULL,
  "unitPrice" INTEGER,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "public"."OrderItem" ("orderId");
