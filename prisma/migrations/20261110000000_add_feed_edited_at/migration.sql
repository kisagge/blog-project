-- 게시 후 제목·요약·본문 수정 시각(수정일 표시·JSON-LD dateModified·sitemap lastModified).
-- 기존 행은 NULL(= 수정 이력 없음 → 게시 시각으로 대체).
ALTER TABLE "Feed" ADD COLUMN "editedAt" DATETIME;
