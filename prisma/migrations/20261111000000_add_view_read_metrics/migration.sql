-- 글별 읽기 지표(익명·일 단위): 기존 View 행(방문자·글·KST 일)에 읽은 깊이·활성 시간을 덧붙인다.
-- 기존 행은 NULL(= 측정 전).
ALTER TABLE "View" ADD COLUMN "scrollDepth" INTEGER;
ALTER TABLE "View" ADD COLUMN "activeSeconds" INTEGER;
