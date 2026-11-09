-- CreateTable
CREATE TABLE "PushToken" (
    "token" TEXT NOT NULL,
    "userId" TEXT,
    "riderId" TEXT,
    "platform" TEXT NOT NULL,
    "app" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("token")
);

-- CreateIndex
CREATE INDEX "PushToken_userId_idx" ON "PushToken"("userId");

-- CreateIndex
CREATE INDEX "PushToken_riderId_idx" ON "PushToken"("riderId");
