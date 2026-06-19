import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";

type Series = typeof import("@/lib/series");
let m: Series;
let cleanup: () => Promise<void>;
let prisma: Awaited<ReturnType<typeof setupTestDb>>["prisma"];

// 시리즈 s1에 글 4개(공개 a,b · 회원 c · 비공개 d, 순서 0..3), s2엔 비공개 글만.
beforeAll(async () => {
  const db = await setupTestDb();
  cleanup = db.cleanup;
  prisma = db.prisma;

  await prisma.series.create({
    data: { id: "s1", slug: "s1", title: "시리즈1", updatedAt: new Date() },
  });
  await prisma.series.create({
    data: { id: "s2", slug: "s2", title: "시리즈2", updatedAt: new Date() },
  });

  const feeds: [string, string, number][] = [
    ["a", "public", 0],
    ["b", "public", 1],
    ["c", "members", 2],
    ["d", "private", 3],
  ];
  let day = 1;
  for (const [id, visibility, order] of feeds) {
    const date = new Date(2026, 0, day++);
    await prisma.feed.create({
      data: {
        id,
        slug: id,
        title: `글-${id}`,
        content: "x",
        visibility,
        status: "published",
        seriesId: "s1",
        seriesOrder: order,
        createdAt: date,
        updatedAt: date,
      },
    });
  }
  // s2: 비공개 글만(비어드민 가시 0).
  await prisma.feed.create({
    data: {
      id: "p",
      slug: "p",
      title: "글-p",
      content: "x",
      visibility: "private",
      status: "published",
      seriesId: "s2",
      seriesOrder: 0,
      createdAt: new Date(2026, 0, 9),
      updatedAt: new Date(2026, 0, 9),
    },
  });
  // 미배정 글(assign 테스트용).
  await prisma.feed.create({
    data: {
      id: "e",
      slug: "e",
      title: "글-e",
      content: "x",
      visibility: "public",
      status: "published",
      createdAt: new Date(2026, 0, 10),
      updatedAt: new Date(2026, 0, 10),
    },
  });

  m = await import("@/lib/series");
});

afterAll(async () => {
  await cleanup();
});

describe("getSeriesPosts 가시성·순서", () => {
  test("anon은 공개 글만 순서대로", async () => {
    const posts = await m.getSeriesPosts("s1", "anon");
    expect(posts.map((p) => p.slug)).toEqual(["a", "b"]);
  });
  test("member는 공개+회원, admin은 전부(순서 유지)", async () => {
    expect((await m.getSeriesPosts("s1", "member")).map((p) => p.slug)).toEqual(
      ["a", "b", "c"],
    );
    expect((await m.getSeriesPosts("s1", "admin")).map((p) => p.slug)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });
});

describe("getSeriesWithCounts", () => {
  test("anon: 가시 글 있는 시리즈만(s1=2), s2 제외", async () => {
    const list = await m.getSeriesWithCounts("anon");
    expect(list.map((s) => [s.slug, s.count])).toEqual([["s1", 2]]);
  });
  test("admin: s1=4, s2=1", async () => {
    const bySlug = Object.fromEntries(
      (await m.getSeriesWithCounts("admin")).map((s) => [s.slug, s.count]),
    );
    expect(bySlug).toEqual({ s1: 4, s2: 1 });
  });
});

describe("getSeriesContext", () => {
  test("anon: 두 번째 글 b → total 2, index 1, prev a, next 없음", async () => {
    const ctx = await m.getSeriesContext({ id: "b", seriesId: "s1" }, "anon");
    expect(ctx).toMatchObject({
      total: 2,
      index: 1,
      prev: { slug: "a" },
      next: null,
    });
    expect(ctx?.series.slug).toBe("s1");
  });
  test("admin: b → total 4, prev a, next c", async () => {
    const ctx = await m.getSeriesContext({ id: "b", seriesId: "s1" }, "admin");
    expect(ctx).toMatchObject({
      total: 4,
      index: 1,
      prev: { slug: "a" },
      next: { slug: "c" },
    });
  });
  test("미배정 글은 null", async () => {
    expect(
      await m.getSeriesContext({ id: "e", seriesId: null }, "admin"),
    ).toBeNull();
  });
});

describe("멤버십·순서 변경", () => {
  test("assignFeedSeries: 새 시리즈면 맨 뒤(order=max+1)", async () => {
    await m.assignFeedSeries("e", "s1");
    const posts = await m.getSeriesPosts("s1", "admin");
    expect(posts.map((p) => p.slug)).toEqual(["a", "b", "c", "d", "e"]);
  });
  test("reorderSeries: 주어진 순서로 재배치", async () => {
    await m.reorderSeries(["b", "a", "c", "d", "e"]);
    expect((await m.getSeriesPosts("s1", "admin")).map((p) => p.slug)).toEqual([
      "b",
      "a",
      "c",
      "d",
      "e",
    ]);
  });
  test("removeFromSeries: 시리즈에서 빠짐", async () => {
    await m.removeFromSeries("e");
    expect(
      (await m.getSeriesPosts("s1", "admin")).map((p) => p.slug),
    ).not.toContain("e");
    const e = await prisma.feed.findUnique({
      where: { id: "e" },
      select: { seriesId: true },
    });
    expect(e?.seriesId).toBeNull();
  });
  test("deleteSeries: 시리즈 삭제 + 글은 미배정 보존", async () => {
    await m.deleteSeries("s2");
    expect(await m.getSeriesBySlug("s2")).toBeNull();
    const p = await prisma.feed.findUnique({
      where: { id: "p" },
      select: { seriesId: true },
    });
    expect(p?.seriesId).toBeNull(); // 글은 보존
  });
});
