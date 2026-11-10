-- 관리자 편집 소개 페이지(/about). 빈 문자열이면 페이지·내비 링크 비노출.
ALTER TABLE "SiteConfig" ADD COLUMN "aboutContent" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SiteConfig" ADD COLUMN "aboutUpdatedAt" DATETIME;
