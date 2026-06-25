-- CreateTable
CREATE TABLE "RogueScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "kills" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RogueScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RogueScore_score_idx" ON "RogueScore"("score");

-- CreateIndex
CREATE INDEX "RogueScore_userId_idx" ON "RogueScore"("userId");
