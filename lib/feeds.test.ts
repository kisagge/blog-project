import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";

type Feeds = typeof import("@/lib/feeds");
let searchFeeds: Feeds["searchFeeds"];
let countFeeds: Feeds["countFeeds"];
let getAdminFeedsPage: Feeds["getAdminFeedsPage"];
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const db = await setupTestDb();
  cleanup = db.cleanup;

  // 전체공개 글 12개(오래된→최신). pub-12가 최신.
  for (let i = 1; i <= 12; i++) {
    const date = new Date(2026, 0, i); // 2026-01-01 .. 01-12
    await db.prisma.feed.create({
      data: {
        id: `pub-${i}`,
        slug: `pub-${i}`,
        title: i === 3 ? "고양이 이야기" : `공개 글 ${i}`,
        summary: i === 9 ? "여우전용요약" : `요약 ${i}`,
        content: i === 7 ? "강아지물고기 본문" : `본문 ${i}`,
        visibility: "public",
        createdAt: date,
        updatedAt: date,
      },
    });
  }
  // 비공개(초안): 공개 목록·검색에서 제외돼야 함(고유 단어).
  await db.prisma.feed.create({
    data: {
      id: "draft-1",
      slug: "draft-1",
      title: "오직비공개단어 초안",
      content: "비공개 본문",
      visibility: "private",
      createdAt: new Date(2026, 1, 1),
      updatedAt: new Date(2026, 1, 1),
    },
  });
  // 회원공개: anon 목록 제외, 회원 목록 포함(고유 단어).
  await db.prisma.feed.create({
    data: {
      id: "mem-1",
      slug: "mem-1",
      title: "회원전용단어 회원글",
      content: "회원 본문",
      visibility: "members",
      createdAt: new Date(2026, 1, 2),
      updatedAt: new Date(2026, 1, 2),
    },
  });

  ({ searchFeeds, countFeeds, getAdminFeedsPage } =
    await import("@/lib/feeds"));
});

afterAll(async () => {
  await cleanup();
});

describe("searchFeeds", () => {
  test("anon 첫 페이지는 10개 + hasMore=true (전체공개 12개)", async () => {
    const { items, hasMore } = await searchFeeds({ role: "anon" });
    expect(items).toHaveLength(10);
    expect(hasMore).toBe(true);
  });

  test("skip으로 다음 페이지: 남은 2개 + hasMore=false", async () => {
    const { items, hasMore } = await searchFeeds({ role: "anon", skip: 10 });
    expect(items).toHaveLength(2);
    expect(hasMore).toBe(false);
  });

  test("최신순 정렬: 첫 글이 가장 최근(pub-12)", async () => {
    const { items } = await searchFeeds({ role: "anon" });
    expect(items[0].slug).toBe("pub-12");
  });

  test("제목 검색", async () => {
    const { items } = await searchFeeds({ role: "anon", q: "고양이" });
    expect(items.map((f) => f.slug)).toEqual(["pub-3"]);
  });

  test("본문 검색(제목·요약엔 없는 단어)", async () => {
    const { items } = await searchFeeds({ role: "anon", q: "강아지물고기" });
    expect(items.map((f) => f.slug)).toEqual(["pub-7"]);
  });

  test("비공개 글은 anon·회원 목록에서 제외, 관리자는 노출", async () => {
    for (const role of ["anon", "member"] as const) {
      const { items } = await searchFeeds({ role, q: "오직비공개단어" });
      expect(items).toHaveLength(0);
    }
    const { items } = await searchFeeds({ role: "admin", q: "오직비공개단어" });
    expect(items).toHaveLength(1);
  });

  test("회원공개 글: anon 제외, 회원 포함", async () => {
    expect(
      (await searchFeeds({ role: "anon", q: "회원전용단어" })).items,
    ).toHaveLength(0);
    const m = await searchFeeds({ role: "member", q: "회원전용단어" });
    expect(m.items.map((f) => f.slug)).toEqual(["mem-1"]);
  });

  test("countFeeds: 전체/공개/회원/비공개 집계", async () => {
    expect(await countFeeds()).toEqual({
      total: 14,
      public: 12,
      members: 1,
      private: 1,
    });
  });

  test("getAdminFeedsPage: 전체 포함 페이지네이션 (총14, size10)", async () => {
    const p1 = await getAdminFeedsPage(1, 10);
    expect(p1.items).toHaveLength(10);
    expect(p1.total).toBe(14);
    const p2 = await getAdminFeedsPage(2, 10);
    expect(p2.items).toHaveLength(4);
  });
});
