import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";
import { makeUser, makeFeed } from "@/lib/test-factories";

type Mod = typeof import("@/lib/bookmarks");
let m: Mod;
let prisma: Awaited<ReturnType<typeof setupTestDb>>["prisma"];
let cleanup: () => Promise<void>;
let u1: string, u2: string, fA: string, fB: string;

beforeAll(async () => {
  const db = await setupTestDb();
  prisma = db.prisma;
  cleanup = db.cleanup;
  u1 = (await makeUser(prisma)).id;
  u2 = (await makeUser(prisma)).id;
  fA = (await makeFeed(prisma)).id;
  fB = (await makeFeed(prisma)).id;
  m = await import("@/lib/bookmarks");
});
afterAll(async () => {
  await cleanup();
});

describe("bookmarks", () => {
  test("toggle: 저장/해제 + 사용자별 상태", async () => {
    expect(await m.toggleBookmark(fA, u1)).toEqual({ bookmarked: true });
    expect(await m.getBookmarkStatus(fA, u1)).toBe(true);
    expect(await m.getBookmarkStatus(fA, u2)).toBe(false); // 다른 사용자
    expect(await m.getBookmarkStatus(fA, undefined)).toBe(false); // 비로그인
    // 다시 누르면 해제
    expect(await m.toggleBookmark(fA, u1)).toEqual({ bookmarked: false });
    expect(await m.getBookmarkStatus(fA, u1)).toBe(false);
  });

  test("listSavedFeeds: 저장 최신순 + 카드 필드 + 사용자 격리", async () => {
    await m.toggleBookmark(fA, u1); // 먼저 저장
    await m.toggleBookmark(fB, u1); // 나중 저장
    const { items, hasMore } = await m.listSavedFeeds(u1);
    expect(items.map((f) => f.id)).toEqual([fB, fA]); // 최신 저장이 먼저
    expect(hasMore).toBe(false);
    // toFeedCard 호환 필드(FEED_LIST_SELECT)
    expect(items[0]).toHaveProperty("slug");
    expect(items[0]).toHaveProperty("author");
    expect(items[0]).toHaveProperty("feedTags");
    // 다른 사용자는 안 보임
    expect((await m.listSavedFeeds(u2)).items).toHaveLength(0);
  });

  test("listSavedFeeds: 비공개·초안·숨김 제외, 회원공개 포함", async () => {
    const priv = (await makeFeed(prisma, { visibility: "private" })).id;
    const draft = (await makeFeed(prisma, { status: "draft" })).id;
    const hidden = (await makeFeed(prisma, { hiddenAt: new Date() })).id;
    const members = (await makeFeed(prisma, { visibility: "members" })).id;
    for (const f of [priv, draft, hidden, members])
      await m.toggleBookmark(f, u2);
    const ids = (await m.listSavedFeeds(u2)).items.map((f) => f.id);
    expect(ids).toContain(members);
    expect(ids).not.toContain(priv);
    expect(ids).not.toContain(draft);
    expect(ids).not.toContain(hidden);
  });

  test("listSavedFeeds: 페이지네이션(take+1·hasMore)", async () => {
    const u3 = (await makeUser(prisma)).id;
    for (let i = 0; i < m.SAVED_PAGE_SIZE + 1; i++) {
      const f = (await makeFeed(prisma)).id;
      await m.toggleBookmark(f, u3);
    }
    const p1 = await m.listSavedFeeds(u3);
    expect(p1.items).toHaveLength(m.SAVED_PAGE_SIZE);
    expect(p1.hasMore).toBe(true);
    const p2 = await m.listSavedFeeds(u3, { skip: m.SAVED_PAGE_SIZE });
    expect(p2.items).toHaveLength(1);
    expect(p2.hasMore).toBe(false);
  });
});
