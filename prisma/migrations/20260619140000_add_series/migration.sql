-- CreateTable: 글 시리즈(관리자 큐레이션).
CREATE TABLE "Series" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- AlterTable: Feed에 시리즈 배정·순서.
ALTER TABLE "Feed" ADD COLUMN "seriesId" TEXT REFERENCES "Series" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Feed" ADD COLUMN "seriesOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Series_slug_key" ON "Series"("slug");
CREATE INDEX "Feed_seriesId_seriesOrder_idx" ON "Feed"("seriesId", "seriesOrder");
