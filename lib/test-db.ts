// 테스트용 임시 SQLite DB 헬퍼.
// 스키마는 실제 마이그레이션으로 만든 템플릿(vitest.global-setup.ts — prisma migrate deploy)을 파일마다
// 복사해 쓴다 → 마이그레이션(FTS·publishedAt 트리거 포함)과 테스트 스키마가 어긋날 수 없다.
// process.env.DATABASE_URL을 복사본으로 지정한 뒤 prisma 클라이언트를 동적 import 한다
// (lib/prisma가 import 시점에 DATABASE_URL을 읽으므로 순서가 중요).
import { copyFileSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { inject } from "vitest";

export async function setupTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "byjang-test-"));
  const file = join(dir, "test.db");
  copyFileSync(inject("testDbTemplate"), file);
  process.env.DATABASE_URL = `file:${file}`;
  const { prisma } = await import("@/lib/prisma");
  return {
    prisma,
    async cleanup() {
      await prisma.$disconnect();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
