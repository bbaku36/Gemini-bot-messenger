-- Create Order table for storing customer orders
CREATE TABLE "public"."Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "contactPhone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- Relation to User
ALTER TABLE "public"."Order"
  ADD CONSTRAINT "Order_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS "Order_userId_idx" ON "public"."Order"("userId");
CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "public"."Order"("status");

