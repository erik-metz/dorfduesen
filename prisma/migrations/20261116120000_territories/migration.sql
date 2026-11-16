CREATE TABLE "TerritorySettings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "enabledAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "TerritorySettings" ("id") VALUES ('revier');
CREATE TABLE "TerritoryClaim" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "activityId" TEXT NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "rulesVersion" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "reason" TEXT,
  "geometry" JSONB,
  "endedAt" TIMESTAMPTZ(3) NOT NULL,
  "checkedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TerritoryClaim_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TerritoryClaim_activityId_key" ON "TerritoryClaim"("activityId");
CREATE INDEX "TerritoryClaim_endedAt_status_idx" ON "TerritoryClaim"("endedAt", "status");
