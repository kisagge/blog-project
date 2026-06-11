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
  `CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feedId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "content" TEXT NOT NULL,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "Feed" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE "Like" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feedId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Like_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "Feed" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE TABLE "CommentLike" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE INDEX "Comment_feedId_idx" ON "Comment"("feedId")`,
  `CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId")`,
  `CREATE UNIQUE INDEX "Like_feedId_userId_key" ON "Like"("feedId", "userId")`,
  `CREATE UNIQUE INDEX "CommentLike_commentId_userId_key" ON "CommentLike"("commentId", "userId")`,
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
