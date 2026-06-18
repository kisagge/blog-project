-- CreateIndex: 저장 목록(listSavedFeeds) where userId + orderBy createdAt desc 커버.
CREATE INDEX "Bookmark_userId_createdAt_idx" ON "Bookmark"("userId", "createdAt");
