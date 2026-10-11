CREATE TABLE "SiteSyncState" (
    "id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiteSyncState_pkey" PRIMARY KEY ("id")
);
