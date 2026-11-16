-- The pricing engine's own tables (prisma/schema.prisma: VariantPricing, RepairCost, DeviceSale, PriceQuote,
-- PricingRecommendation, PriceHistory; prisma/migrations/20261116000000_pricing_engine). The backend runs this on
-- startup (PricingSchema), so a deploy needs no hand-run SQL; every statement is IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "VariantPricing" (
    "variantId" TEXT NOT NULL,
    "launchPrice" INTEGER,
    "launchMonth" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'auto',
    "marketFactor" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "lastAutoAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VariantPricing_pkey" PRIMARY KEY ("variantId")
);

CREATE TABLE IF NOT EXISTS "RepairCost" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "brandId" TEXT NOT NULL DEFAULT '',
    "modelId" TEXT NOT NULL DEFAULT '',
    "part" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "note" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RepairCost_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RepairCost_category_brandId_modelId_part_source_key"
    ON "RepairCost"("category", "brandId", "modelId", "part", "source");

CREATE TABLE IF NOT EXISTS "DeviceSale" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "variantId" TEXT,
    "modelId" TEXT,
    "device" TEXT NOT NULL,
    "category" TEXT,
    "purchasePrice" INTEGER NOT NULL,
    "basePrice" INTEGER,
    "salePrice" INTEGER NOT NULL,
    "repairCost" INTEGER NOT NULL DEFAULT 0,
    "repairs" TEXT,
    "channel" TEXT,
    "grade" TEXT,
    "note" TEXT,
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceSale_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceSale_orderId_key" ON "DeviceSale"("orderId");
CREATE INDEX IF NOT EXISTS "DeviceSale_modelId_idx" ON "DeviceSale"("modelId");

CREATE TABLE IF NOT EXISTS "PriceQuote" (
    "id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "orderId" TEXT,
    "variantId" TEXT,
    "device" TEXT,
    "category" TEXT,
    "basePrice" INTEGER,
    "price" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION,
    "engineVersion" TEXT,
    "answers" TEXT,
    "breakdown" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceQuote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PriceQuote_variantId_idx" ON "PriceQuote"("variantId");
CREATE INDEX IF NOT EXISTS "PriceQuote_orderId_idx" ON "PriceQuote"("orderId");
CREATE INDEX IF NOT EXISTS "PriceQuote_createdAt_idx" ON "PriceQuote"("createdAt");

CREATE TABLE IF NOT EXISTS "PricingRecommendation" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "currentValue" DOUBLE PRECISION,
    "suggestedValue" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION,
    "evidence" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "autoApplied" BOOLEAN NOT NULL DEFAULT false,
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PricingRecommendation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PricingRecommendation_status_idx" ON "PricingRecommendation"("status");
CREATE INDEX IF NOT EXISTS "PricingRecommendation_kind_targetKey_idx" ON "PricingRecommendation"("kind", "targetKey");

CREATE TABLE IF NOT EXISTS "PriceHistory" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "oldPrice" INTEGER,
    "newPrice" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PriceHistory_variantId_idx" ON "PriceHistory"("variantId");
