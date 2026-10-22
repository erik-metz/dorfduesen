CREATE TABLE "MobileHealthConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "consentedTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "consentVersion" TEXT,
    "consentedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "syncCursor" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MobileHealthConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MobileHealthRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "value" JSONB NOT NULL,
    "sourceName" TEXT,
    "sourceId" TEXT,
    "recordedAt" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MobileHealthRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MobileHealthConnection_userId_provider_key" ON "MobileHealthConnection"("userId", "provider");
CREATE INDEX "MobileHealthConnection_userId_revokedAt_idx" ON "MobileHealthConnection"("userId", "revokedAt");
CREATE UNIQUE INDEX "MobileHealthRecord_userId_provider_recordId_key" ON "MobileHealthRecord"("userId", "provider", "recordId");
CREATE INDEX "MobileHealthRecord_userId_recordType_startAt_idx" ON "MobileHealthRecord"("userId", "recordType", "startAt");
CREATE INDEX "MobileHealthRecord_userId_provider_startAt_idx" ON "MobileHealthRecord"("userId", "provider", "startAt");

ALTER TABLE "MobileHealthConnection" ADD CONSTRAINT "MobileHealthConnection_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MobileHealthRecord" ADD CONSTRAINT "MobileHealthRecord_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
