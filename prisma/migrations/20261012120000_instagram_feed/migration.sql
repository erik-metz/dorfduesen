CREATE TABLE "InstagramFeedState" (
    "id" TEXT NOT NULL,
    "posts" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "accessToken" TEXT NOT NULL,
    "tokenUpdatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InstagramFeedState_pkey" PRIMARY KEY ("id")
);
