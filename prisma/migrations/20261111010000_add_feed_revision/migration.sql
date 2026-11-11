-- 관리자 글 수정 이력(되돌리기·비교). 글당 최근 N개만 앱에서 보존, 글 삭제 시 CASCADE.
CREATE TABLE "FeedRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feedId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedRevision_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "Feed" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "FeedRevision_feedId_createdAt_idx" ON "FeedRevision"("feedId", "createdAt");
