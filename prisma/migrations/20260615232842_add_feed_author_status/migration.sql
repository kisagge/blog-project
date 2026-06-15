-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Feed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "status" TEXT NOT NULL DEFAULT 'published',
    "authorId" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Feed_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Feed" ("content", "createdAt", "id", "slug", "summary", "title", "updatedAt", "viewCount", "visibility") SELECT "content", "createdAt", "id", "slug", "summary", "title", "updatedAt", "viewCount", "visibility" FROM "Feed";
DROP TABLE "Feed";
ALTER TABLE "new_Feed" RENAME TO "Feed";
CREATE UNIQUE INDEX "Feed_slug_key" ON "Feed"("slug");
CREATE INDEX "Feed_visibility_createdAt_idx" ON "Feed"("visibility", "createdAt");
CREATE INDEX "Feed_authorId_status_idx" ON "Feed"("authorId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
