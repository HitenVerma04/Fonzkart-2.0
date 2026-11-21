-- Partners responsible for more than one city (the backend also runs this on startup: PartnerCities.ensureTable).
CREATE TABLE IF NOT EXISTS "PartnerCity" (
    "partnerId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartnerCity_pkey" PRIMARY KEY ("partnerId", "cityId")
);
CREATE INDEX IF NOT EXISTS "PartnerCity_cityId_idx" ON "PartnerCity"("cityId");
