import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";
import { makeUser, makeFeed } from "@/lib/test-factories";

type Mod = typeof import("@/lib/likes");
let m: Mod;
let prisma: import("@/app/generated/prisma/client").PrismaClient;
let cleanup: () => Promise<void>;
let feedId: string, u1: string, u2: string;

beforeAll(async () => {
  const db = await setupTestDb();
  prisma = db.prisma;
  cleanup = db.cleanup;
  feedId = (await makeFeed(prisma)).id;
  u1 = (await makeUser(prisma)).id;
  u2 = (await makeUser(prisma)).id;
  m = await import("@/lib/likes");
});
afterAll(async () => {
  await cleanup();
});

describe("likes", () => {
  test("toggle: 처음엔 생성(liked)+count, 다시 누르면 취소", async () => {
    expect(await m.toggleLike(feedId, u1)).toEqual({ liked: true, count: 1 });
    expect(await m.getLikeSummary(feedId, u1)).toEqual({
      count: 1,
      liked: true,
    });
    expect(await m.toggleLike(feedId, u1)).toEqual({ liked: false, count: 0 });
    expect(await m.getLikeSummary(feedId, u1)).toEqual({
      count: 0,
      liked: false,
    });
  });
  test("여러 사용자 카운트 + liked는 사용자별", async () => {
    expect(await m.toggleLike(feedId, u1)).toEqual({ liked: true, count: 1 });
    expect(await m.toggleLike(feedId, u2)).toEqual({ liked: true, count: 2 });
    expect(await m.getLikeSummary(feedId, u1)).toEqual({
      count: 2,
      liked: true,
    });
    expect(await m.getLikeSummary(feedId, undefined)).toEqual({
      count: 2,
      liked: false,
    });
  });
});
