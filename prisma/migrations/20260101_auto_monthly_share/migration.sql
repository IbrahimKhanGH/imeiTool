-- Add monthly sheet rollover + sharing fields to Credential
ALTER TABLE "Credential"
  ADD COLUMN "autoMonthlySheets" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "monthlySheetPrefix" TEXT,
  ADD COLUMN "currentSheetMonth" TEXT,
  ADD COLUMN "currentSheetIdEnc" TEXT,
  ADD COLUMN "monthlyShareEmailsEnc" TEXT;

