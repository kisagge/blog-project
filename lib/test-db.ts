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
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "status" TEXT NOT NULL DEFAULT 'published',
    "authorId" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" DATETIME,
    "hiddenAt" DATETIME,
    "seriesId" TEXT,
    "seriesOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Feed_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Feed_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE "Series" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE UNIQUE INDEX "Series_slug_key" ON "Series"("slug")`,
  `CREATE UNIQUE INDEX "Feed_slug_key" ON "Feed"("slug")`,
  `CREATE INDEX "Feed_status_visibility_createdAt_idx" ON "Feed"("status", "visibility", "createdAt")`,
  `CREATE INDEX "Feed_authorId_status_publishedAt_idx" ON "Feed"("authorId", "status", "publishedAt")`,
  `CREATE INDEX "Feed_seriesId_seriesOrder_idx" ON "Feed"("seriesId", "seriesOrder")`,
  `CREATE TABLE "View" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX "View_entityType_entityId_idx" ON "View"("entityType", "entityId")`,
  `CREATE INDEX "View_entityType_day_idx" ON "View"("entityType", "day")`,
  `CREATE UNIQUE INDEX "View_entityType_entityId_visitorId_day_key" ON "View"("entityType", "entityId", "visitorId", "day")`,
  `CREATE TABLE "SiteConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "publicEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "rejectedAt" DATETIME,
    "notifyOnReply" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnComment" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnMention" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnFollow" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE "Follow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId")`,
  `CREATE INDEX "Follow_followerId_createdAt_idx" ON "Follow"("followerId", "createdAt")`,
  `CREATE INDEX "Follow_followingId_createdAt_idx" ON "Follow"("followingId", "createdAt")`,
  `CREATE UNIQUE INDEX "User_email_key" ON "User"("email")`,
  `CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint")`,
  `CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId")`,
  `CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt")`,
  `CREATE TABLE "PasswordResetCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verifiedAt" DATETIME,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX "PasswordResetCode_email_idx" ON "PasswordResetCode"("email")`,
  `CREATE TABLE "DfCharacter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serverId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "characterName" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX "DfCharacter_serverId_characterId_key" ON "DfCharacter"("serverId", "characterId")`,
  `CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feedId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "content" TEXT NOT NULL,
    "deletedAt" DATETIME,
    "hiddenAt" DATETIME,
    "editedAt" DATETIME,
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
  `CREATE INDEX "Comment_userId_createdAt_idx" ON "Comment"("userId", "createdAt")`,
  `CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feedId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bookmark_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "Feed" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX "Like_feedId_userId_key" ON "Like"("feedId", "userId")`,
  `CREATE UNIQUE INDEX "CommentLike_commentId_userId_key" ON "CommentLike"("commentId", "userId")`,
  `CREATE UNIQUE INDEX "Bookmark_feedId_userId_key" ON "Bookmark"("feedId", "userId")`,
  `CREATE INDEX "Bookmark_userId_createdAt_idx" ON "Bookmark"("userId", "createdAt")`,
  `CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt")`,
  `CREATE UNIQUE INDEX "Report_targetType_targetId_reporterId_key" ON "Report"("targetType", "targetId", "reporterId")`,
  `CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug")`,
  `CREATE TABLE "FeedTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feedId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedTag_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "Feed" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeedTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX "FeedTag_feedId_tagId_key" ON "FeedTag"("feedId", "tagId")`,
  `CREATE INDEX "FeedTag_tagId_idx" ON "FeedTag"("tagId")`,
  // 전문 검색(FTS5) — prisma/migrations/*_add_feed_fts/migration.sql과 동기화 필수.
  // external content + trigram. 트리거가 Feed 변경을 색인하므로 백필 INSERT는 불필요(빈 테이블).
  `CREATE VIRTUAL TABLE "feed_fts" USING fts5(
    title, summary, content,
    content='Feed', content_rowid='rowid', tokenize='trigram'
  )`,
  `CREATE TRIGGER "feed_fts_ai" AFTER INSERT ON "Feed" BEGIN
    INSERT INTO "feed_fts"(rowid, title, summary, content)
    VALUES (new.rowid, new.title, new.summary, new.content);
  END`,
  `CREATE TRIGGER "feed_fts_ad" AFTER DELETE ON "Feed" BEGIN
    INSERT INTO "feed_fts"(feed_fts, rowid, title, summary, content)
    VALUES ('delete', old.rowid, old.title, old.summary, old.content);
  END`,
  // UPDATE OF: 텍스트 컬럼 변경 시에만 재색인(viewCount 등 비텍스트 UPDATE는 건너뜀).
  `CREATE TRIGGER "feed_fts_au" AFTER UPDATE OF title, summary, content ON "Feed" BEGIN
    INSERT INTO "feed_fts"(feed_fts, rowid, title, summary, content)
    VALUES ('delete', old.rowid, old.title, old.summary, old.content);
    INSERT INTO "feed_fts"(rowid, title, summary, content)
    VALUES (new.rowid, new.title, new.summary, new.content);
  END`,
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
