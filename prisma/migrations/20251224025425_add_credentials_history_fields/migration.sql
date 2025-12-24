/*
  Warnings:

  - Made the column `tenantId` on table `Lookup` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userId` on table `Lookup` required. This step will fail if there are existing NULL values in that column.

*/
-- Backfill legacy tenant/user so NOT NULL can be applied safely
DO $$
DECLARE
  v_tenant_id TEXT;
  v_user_id   TEXT;
BEGIN
  SELECT id INTO v_tenant_id FROM "Tenant" ORDER BY "createdAt" ASC LIMIT 1;
  IF v_tenant_id IS NULL THEN
    v_tenant_id := 'legacy-tenant';
    INSERT INTO "Tenant" ("id", "name", "createdAt")
    VALUES (v_tenant_id, 'Legacy Tenant', NOW());
  END IF;

  SELECT id INTO v_user_id FROM "User" ORDER BY "createdAt" ASC LIMIT 1;
  IF v_user_id IS NULL THEN
    v_user_id := 'legacy-user';
    INSERT INTO "User" ("id", "email", "passwordHash", "createdAt")
    VALUES (v_user_id, 'legacy@example.com', 'legacy-placeholder', NOW());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "Membership" WHERE "userId" = v_user_id AND "tenantId" = v_tenant_id
  ) THEN
    INSERT INTO "Membership" ("id", "userId", "tenantId", "role", "createdAt")
    VALUES (concat('legacy-', md5(random()::text)), v_user_id, v_tenant_id, 'admin', NOW());
  END IF;

  UPDATE "Lookup"
    SET "tenantId" = v_tenant_id
  WHERE "tenantId" IS NULL;

  UPDATE "Lookup"
    SET "userId" = v_user_id
  WHERE "userId" IS NULL;
END $$;

-- DropForeignKey
ALTER TABLE "Lookup" DROP CONSTRAINT "Lookup_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Lookup" DROP CONSTRAINT "Lookup_userId_fkey";

-- AlterTable
ALTER TABLE "Lookup" ADD COLUMN     "blacklistStatus" TEXT,
ADD COLUMN     "carrier" TEXT,
ADD COLUMN     "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "modelName" TEXT,
ADD COLUMN     "purchaseCountry" TEXT,
ADD COLUMN     "serial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serviceName" TEXT,
ADD COLUMN     "simLock" TEXT,
ADD COLUMN     "source" TEXT,
ALTER COLUMN "tenantId" SET NOT NULL,
ALTER COLUMN "userId" SET NOT NULL;

-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sickwKeyEnc" TEXT,
    "googleSheetsIdEnc" TEXT,
    "googleServiceAccountEmailEnc" TEXT,
    "googleServiceAccountPrivateKeyEnc" TEXT,
    "defaultTab" TEXT,
    "timezone" TEXT DEFAULT 'America/Chicago',
    "syncToSheets" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Credential_tenantId_key" ON "Credential"("tenantId");

-- CreateIndex
CREATE INDEX "Lookup_tenantId_createdAt_idx" ON "Lookup"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Lookup_tenantId_imei_idx" ON "Lookup"("tenantId", "imei");

-- AddForeignKey
ALTER TABLE "Lookup" ADD CONSTRAINT "Lookup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lookup" ADD CONSTRAINT "Lookup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
