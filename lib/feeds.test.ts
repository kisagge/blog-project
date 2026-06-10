import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";

type Feeds = typeof import("@/lib/feeds");
let searchPublishedFeeds: Feeds["searchPublishedFeeds"];
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const db = await setupTestDb();
  cleanup = db.cleanup;

  // 공개 글 12개(오래된→최신). pub-12가 최신.
  for (let i = 1; i <= 12; i++) {
    const date = new Date(2026, 0, i); // 2026-01-01 .. 01-12
    await db.prisma.feed.create({
      data: {
        id: `pub-${i}`,
        slug: `pub-${i}`,
        title: i === 3 ? "고양이 이야기" : `공개 글 ${i}`,
        summary: i === 9 ? "여우전용요약" : `요약 ${i}`,
        content: i === 7 ? "강아지물고기 본문" : `본문 ${i}`,
        published: true,
        createdAt: date,
        updatedAt: date,
      },
    });
  }
  // 비공개 글: 검색 필터가 published만 보는지 확인용(고유 단어).
  await db.prisma.feed.create({
    data: {
      id: "draft-1",
      slug: "draft-1",
      title: "오직비공개단어 초안",
      summary: null,
      content: "비공개 본문",
      published: false,
      createdAt: new Date(2026, 1, 1),
      updatedAt: new Date(2026, 1, 1),
    },
  });

  ({ searchPublishedFeeds } = await import("@/lib/feeds"));
});

afterAll(async () => {
  await cleanup();
});

describe("searchPublishedFeeds", () => {
  test("첫 페이지는 10개 + hasMore=true (공개글 12개)", async () => {
    const { items, hasMore } = await searchPublishedFeeds({});
    expect(items).toHaveLength(10);
    expect(hasMore).toBe(true);
  });

  test("skip으로 다음 페이지: 남은 2개 + hasMore=false", async () => {
    const { items, hasMore } = await searchPublishedFeeds({ skip: 10 });
    expect(items).toHaveLength(2);
    expect(hasMore).toBe(false);
  });

  test("최신순 정렬: 첫 글이 가장 최근(pub-12)", async () => {
    const { items } = await searchPublishedFeeds({});
    expect(items[0].slug).toBe("pub-12");
  });

  test("제목 검색", async () => {
    const { items } = await searchPublishedFeeds({ q: "고양이" });
    expect(items.map((f) => f.slug)).toEqual(["pub-3"]);
  });

  test("본문 검색(제목·요약엔 없는 단어)", async () => {
    const { items } = await searchPublishedFeeds({ q: "강아지물고기" });
    expect(items.map((f) => f.slug)).toEqual(["pub-7"]);
  });

  test("요약 검색(제목·본문엔 없는 단어)", async () => {
    const { items } = await searchPublishedFeeds({ q: "여우전용요약" });
    expect(items.map((f) => f.slug)).toEqual(["pub-9"]);
  });

  test("비공개 글은 검색에서 제외", async () => {
    const { items, hasMore } = await searchPublishedFeeds({
      q: "오직비공개단어",
    });
    expect(items).toHaveLength(0);
    expect(hasMore).toBe(false);
  });

  test("take 경계: 결과가 정확히 take개면 hasMore=false", async () => {
    const { items, hasMore } = await searchPublishedFeeds({
      q: "고양이",
      take: 1,
    });
    expect(items).toHaveLength(1);
    expect(hasMore).toBe(false);
  });
});
