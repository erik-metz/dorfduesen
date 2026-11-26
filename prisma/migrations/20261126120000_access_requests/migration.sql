-- AlterTable
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'MEMBER';

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL,
    "stravaAthleteId" TEXT NOT NULL,
    "firstname" TEXT,
    "lastname" TEXT,
    "username" TEXT,
    "profile" TEXT,
    "city" TEXT,
    "country" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessRequest_stravaAthleteId_key" ON "AccessRequest"("stravaAthleteId");

-- CreateIndex
CREATE INDEX "AccessRequest_status_lastAttemptAt_idx" ON "AccessRequest"("status", "lastAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");

-- CreateIndex
CREATE INDEX "PushToken_userId_idx" ON "PushToken"("userId");

-- AddForeignKey
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Club admin (Erik). Further admins can be granted by setting role = 'ADMIN'.
UPDATE "User" SET "role" = 'ADMIN' WHERE "stravaAthleteId" = '7862817';
