CREATE TABLE "WeeklyGoal" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "weekKey" TEXT NOT NULL,
  "activeDays" INTEGER NOT NULL CHECK ("activeDays" BETWEEN 1 AND 7),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WeeklyGoal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WeeklyGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WeeklyGoal_userId_weekKey_key" ON "WeeklyGoal"("userId", "weekKey");
