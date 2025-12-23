/*
  Warnings:

  - You are about to drop the `Credential` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Credential" DROP CONSTRAINT "Credential_tenantId_fkey";

-- DropIndex
DROP INDEX "Lookup_tenantId_idx";

-- AlterTable
ALTER TABLE "Membership" ALTER COLUMN "role" DROP DEFAULT;

-- DropTable
DROP TABLE "Credential";
