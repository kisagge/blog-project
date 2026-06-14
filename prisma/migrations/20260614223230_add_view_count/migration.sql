-- CreateTable
CREATE TABLE "View" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DfCharacter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serverId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "characterName" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_DfCharacter" ("characterId", "characterName", "createdAt", "id", "serverId", "sortOrder") SELECT "characterId", "characterName", "createdAt", "id", "serverId", "sortOrder" FROM "DfCharacter";
DROP TABLE "DfCharacter";
ALTER TABLE "new_DfCharacter" RENAME TO "DfCharacter";
CREATE UNIQUE INDEX "DfCharacter_serverId_characterId_key" ON "DfCharacter"("serverId", "characterId");
CREATE TABLE "new_Feed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Feed" ("content", "createdAt", "id", "published", "slug", "summary", "title", "updatedAt") SELECT "content", "createdAt", "id", "published", "slug", "summary", "title", "updatedAt" FROM "Feed";
DROP TABLE "Feed";
ALTER TABLE "new_Feed" RENAME TO "Feed";
CREATE UNIQUE INDEX "Feed_slug_key" ON "Feed"("slug");
CREATE INDEX "Feed_published_createdAt_idx" ON "Feed"("published", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "View_entityType_entityId_idx" ON "View"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "View_entityType_entityId_visitorId_day_key" ON "View"("entityType", "entityId", "visitorId", "day");
