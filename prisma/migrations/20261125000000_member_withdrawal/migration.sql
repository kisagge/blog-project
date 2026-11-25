-- 회원 탈퇴: 탈퇴 시각 기록(탈퇴 회원 행은 익명화해 남김 — 글·댓글 보존용).
ALTER TABLE "User" ADD COLUMN "withdrawnAt" DATETIME;

-- 차단 상태로 탈퇴한 회원의 이메일 해시(SHA-256). 같은 이메일 재가입으로 차단을 피하지 못하게 한다.
-- 이메일 원문은 보관하지 않는다.
CREATE TABLE "BlockedEmail" (
    "emailHash" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
