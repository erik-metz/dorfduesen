CREATE TABLE "TerritoryProjectionCache" (
    "seasonKey" TEXT NOT NULL,
    "inputHash" TEXT,
    "projection" JSONB,
    "failedInputHash" TEXT,
    "retryAt" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "TerritoryProjectionCache_pkey" PRIMARY KEY ("seasonKey")
);
