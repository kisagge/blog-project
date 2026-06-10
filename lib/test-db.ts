// 테스트용 임시 SQLite DB 헬퍼.
// process.env.DATABASE_URL을 임시 파일로 지정한 뒤 prisma 클라이언트를 동적 import 한다
// (lib/prisma가 import 시점에 DATABASE_URL을 읽으므로 순서가 중요).
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// prisma/migrations 의 DDL과 동일(테스트 격리를 위해 인라인).
const SCHEMA = [
  `CREATE TABLE "Feed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE UNIQUE INDEX "Feed_slug_key" ON "Feed"("slug")`,
  `CREATE TABLE "SiteConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "publicEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE UNIQUE INDEX "User_email_key" ON "User"("email")`,
];

export async function setupTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "byjang-test-"));
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
  const { prisma } = await import("@/lib/prisma");
  for (const stmt of SCHEMA) await prisma.$executeRawUnsafe(stmt);
  return {
    prisma,
    async cleanup() {
      await prisma.$disconnect();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
