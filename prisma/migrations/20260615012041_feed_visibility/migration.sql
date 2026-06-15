-- Feed.published(Boolean) → Feed.visibility(String). 기존 데이터 변환: 공개→public, 초안→private.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Feed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Feed" ("id","slug","title","summary","content","visibility","viewCount","createdAt","updatedAt")
SELECT "id","slug","title","summary","content",
  CASE WHEN "published" = 1 THEN 'public' ELSE 'private' END,
  "viewCount","createdAt","updatedAt" FROM "Feed";
DROP TABLE "Feed";
ALTER TABLE "new_Feed" RENAME TO "Feed";
CREATE UNIQUE INDEX "Feed_slug_key" ON "Feed"("slug");
CREATE INDEX "Feed_visibility_createdAt_idx" ON "Feed"("visibility", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
