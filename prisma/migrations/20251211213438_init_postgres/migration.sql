-- CreateTable
CREATE TABLE "Lookup" (
    "id" SERIAL NOT NULL,
    "imei" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "balance" DOUBLE PRECISION,
    "resultJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lookup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lookup_imei_serviceId_idx" ON "Lookup"("imei", "serviceId");
