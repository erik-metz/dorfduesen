-- CreateTable
CREATE TABLE "PlanGenerationAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanGenerationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "userId" TEXT NOT NULL,
    "historicalPage" INTEGER NOT NULL DEFAULT 1,
    "historicalBefore" INTEGER,
    "historyCompletedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "lockOwner" TEXT,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "PlanGenerationAttempt_userId_createdAt_idx" ON "PlanGenerationAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_userId_startDate_idx" ON "Activity"("userId", "startDate");

-- CreateIndex
CREATE INDEX "PlanWorkout_matchedActivityId_idx" ON "PlanWorkout"("matchedActivityId");

-- AddForeignKey
ALTER TABLE "PlanGenerationAttempt" ADD CONSTRAINT "PlanGenerationAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncState" ADD CONSTRAINT "SyncState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Preserve today's existing generation count when adopting the independent ledger.
INSERT INTO "PlanGenerationAttempt" ("id", "userId", "planId", "createdAt")
SELECT 'legacy:' || "id", "userId", "id", "createdAt" FROM "TrainingPlan";
