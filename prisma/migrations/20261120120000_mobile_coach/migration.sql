-- CreateTable
CREATE TABLE "CoachConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachTurn" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "proposal" JSONB,
    "sources" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachChatQuota" (
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "CoachChatQuota_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "CoachConversation_userId_updatedAt_id_idx" ON "CoachConversation"("userId", "updatedAt", "id");

-- CreateIndex
CREATE INDEX "CoachTurn_conversationId_createdAt_id_idx" ON "CoachTurn"("conversationId", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "CoachConversation" ADD CONSTRAINT "CoachConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachTurn" ADD CONSTRAINT "CoachTurn_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CoachConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachChatQuota" ADD CONSTRAINT "CoachChatQuota_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
