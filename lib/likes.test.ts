import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";

type Mod = typeof import("@/lib/likes");
let m: Mod;
let prisma: import("@/app/generated/prisma/client").PrismaClient;
let cleanup: () => Promise<void>;
let feedId: string, u1: string, u2: string;

beforeAll(async () => {
  const db = await setupTestDb();
  prisma = db.prisma; cleanup = db.cleanup;
  const f = await prisma.feed.create({ data: { slug: "f", title: "T", content: "c", published: true } });
  feedId = f.id;
  u1 = (await prisma.user.create({ data: { email: "1@x.com", nickname: "u1", passwordHash: "-", status: "approved" } })).id;
  u2 = (await prisma.user.create({ data: { email: "2@x.com", nickname: "u2", passwordHash: "-", status: "approved" } })).id;
  m = await import("@/lib/likes");
});
afterAll(async () => { await cleanup(); });

describe("likes", () => {
  test("toggle: 처음엔 생성(liked), 다시 누르면 취소", async () => {
    expect(await m.toggleLike(feedId, u1)).toBe(true);
    expect(await m.getLikeSummary(feedId, u1)).toEqual({ count: 1, liked: true });
    expect(await m.toggleLike(feedId, u1)).toBe(false);
    expect(await m.getLikeSummary(feedId, u1)).toEqual({ count: 0, liked: false });
  });
  test("여러 사용자 카운트 + liked는 사용자별", async () => {
    await m.toggleLike(feedId, u1);
    await m.toggleLike(feedId, u2);
    expect(await m.getLikeSummary(feedId, u1)).toEqual({ count: 2, liked: true });
    expect(await m.getLikeSummary(feedId, undefined)).toEqual({ count: 2, liked: false });
  });
});
