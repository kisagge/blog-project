-- 공개 "게시일"을 publishedAt 하나로 통일한다. 예전엔 관리자 즉시 게시 글에 publishedAt이 없어
-- 공개 목록·RSS·아카이브가 작성일(createdAt)로 정렬했고, 예약 발행 글이 과거 날짜로 묻혔다.
-- 1) 기존 게시 글 백필(게시 시각을 모르니 작성 시각으로)
UPDATE "Feed" SET "publishedAt" = "createdAt" WHERE "status" = 'published' AND "publishedAt" IS NULL;

-- 2) 불변식: 게시 상태인 글은 publishedAt이 항상 있다(어느 코드 경로·테스트 픽스처든).
--    삽입 시 비어 있으면 작성 시각, 게시로 바뀔 때 비어 있으면 현재 시각. 명시한 값은 그대로.
--    (FTS처럼 schema.prisma 밖 raw SQL — lib/test-db.ts와 동기화 필수)
CREATE TRIGGER "feed_published_at_ai" AFTER INSERT ON "Feed"
WHEN NEW."status" = 'published' AND NEW."publishedAt" IS NULL
BEGIN
  UPDATE "Feed" SET "publishedAt" = NEW."createdAt" WHERE "id" = NEW."id";
END;

CREATE TRIGGER "feed_published_at_au" AFTER UPDATE OF "status" ON "Feed"
WHEN NEW."status" = 'published' AND NEW."publishedAt" IS NULL
BEGIN
  UPDATE "Feed" SET "publishedAt" = strftime('%Y-%m-%dT%H:%M:%f+00:00', 'now') WHERE "id" = NEW."id";
END;

-- 3) 공개 목록 정렬 인덱스를 게시 시각 기준으로
DROP INDEX "Feed_status_visibility_createdAt_idx";
CREATE INDEX "Feed_status_visibility_publishedAt_idx" ON "Feed"("status", "visibility", "publishedAt");
