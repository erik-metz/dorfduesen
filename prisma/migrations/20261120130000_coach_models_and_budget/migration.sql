ALTER TABLE "CoachChatQuota" ADD COLUMN "premiumCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "CoachModelCatalog" (
  "id" INTEGER NOT NULL PRIMARY KEY,
  "data" JSONB,
  "nextRefresh" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "CoachSpend" (
  "month" TEXT NOT NULL PRIMARY KEY,
  "ticks" BIGINT NOT NULL
);
