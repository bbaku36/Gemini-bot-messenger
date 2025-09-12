-- Add role column to Message to store sender ('user' | 'bot')
ALTER TABLE "public"."Message"
  ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'user';

CREATE INDEX IF NOT EXISTS "Message_userId_createdAt_idx"
  ON "public"."Message" ("userId", "createdAt");

