-- 세션 무효화 버전. JWT의 sv와 다르면 그 로그인은 무효(비밀번호 재설정·차단 시 +1).
-- 기존 행은 0 — sv 없는 옛 토큰도 0으로 간주하므로 배포 시 로그인은 유지된다.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
