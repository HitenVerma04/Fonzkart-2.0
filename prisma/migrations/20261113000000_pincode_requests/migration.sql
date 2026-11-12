-- CreateTable
CREATE TABLE "PincodeRequest" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "cityId" TEXT,
    "pincodes" TEXT[],
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approved" TEXT[],
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PincodeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PincodeRequest_partnerId_idx" ON "PincodeRequest"("partnerId");

-- CreateIndex
CREATE INDEX "PincodeRequest_status_idx" ON "PincodeRequest"("status");
