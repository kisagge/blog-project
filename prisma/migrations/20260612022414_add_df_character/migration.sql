-- CreateTable
CREATE TABLE "DfCharacter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serverId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "characterName" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "DfCharacter_serverId_characterId_key" ON "DfCharacter"("serverId", "characterId");
