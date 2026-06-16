-- DropIndex
DROP INDEX "Feed_authorId_status_idx";

-- DropIndex
DROP INDEX "Feed_visibility_createdAt_idx";

-- CreateIndex
CREATE INDEX "Feed_status_visibility_createdAt_idx" ON "Feed"("status", "visibility", "createdAt");

-- CreateIndex
CREATE INDEX "Feed_authorId_status_publishedAt_idx" ON "Feed"("authorId", "status", "publishedAt");
