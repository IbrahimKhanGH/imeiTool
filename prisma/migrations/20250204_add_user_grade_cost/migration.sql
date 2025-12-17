-- Add optional grade and cost columns for lookups
ALTER TABLE "Lookup" ADD COLUMN IF NOT EXISTS "userGrade" TEXT;
ALTER TABLE "Lookup" ADD COLUMN IF NOT EXISTS "userCost" DOUBLE PRECISION;


