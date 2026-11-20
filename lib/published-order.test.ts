// 예약 발행 글 날짜: 작성(createdAt)은 오래전이어도 게시(publishedAt)가 최근이면 공개 목록·RSS·아카이브·
// 이전/다음에서 게시 시각 기준으로 놓여야 한다(예전엔 작성일 기준이라 과거 날짜로 묻힘).
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";

let prisma: Awaited<ReturnType<typeof setupTestDb>>["prisma"];
let cleanup: () => Promise<void>;
type Feeds = typeof import("@/lib/feeds");
let f: Feeds;

const D = (s: string) => new Date(`${s}T00:00:00.000Z`);

beforeAll(async () => {
  const db = await setupTestDb();
  prisma = db.prisma;
  cleanup = db.cleanup;
  const tag = await prisma.tag.create({ data: { slug: "po", name: "po" } });
  // 1월에 쓰고 3월에 예약 발행된 글
  const scheduled = await prisma.feed.create({
    data: {
      id: "sched",
      slug: "sched",
      title: "예약글",
      content: "예약 본문 검색어",
      visibility: "public",
      createdAt: D("2026-01-01"),
      publishedAt: D("2026-03-01"),
    },
  });
  // 2월에 쓰고 바로 게시한 글(publishedAt 미지정 → 트리거가 createdAt으로 채움)
  const normal = await prisma.feed.create({
    data: {
      id: "normal",
      slug: "normal",
      title: "일반글",
      content: "일반 본문 검색어",
      visibility: "public",
      createdAt: D("2026-02-01"),
    },
  });
  for (const id of [scheduled.id, normal.id])
    await prisma.feedTag.create({ data: { feedId: id, tagId: tag.id } });
  f = await import("@/lib/feeds");
});
afterAll(async () => {
  await cleanup();
});

describe("publishedAt 불변식(트리거)", () => {
  test("게시 상태로 만들면 publishedAt이 비어 있지 않음(createdAt으로 채움)", async () => {
    const row = await prisma.feed.findUnique({ where: { id: "normal" } });
    expect(row!.publishedAt?.toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });

  test("임시저장은 비워 두고, 게시로 바뀌는 순간 채움", async () => {
    const d = await prisma.feed.create({
      data: { slug: "d1", title: "d", content: "c", status: "draft" },
    });
    expect(d.publishedAt).toBeNull();
    const before = Date.now();
    await prisma.feed.update({
      where: { id: d.id },
      data: { status: "published" },
    });
    const after = await prisma.feed.findUnique({ where: { id: d.id } });
    expect(after!.publishedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    await prisma.feed.delete({ where: { id: d.id } });
  });

  test("명시한 publishedAt은 덮어쓰지 않음", async () => {
    const row = await prisma.feed.findUnique({ where: { id: "sched" } });
    expect(row!.publishedAt?.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });
});

describe("공개 표면은 게시 시각 기준", () => {
  test("목록 최신순(기본·검색 2자 폴백·FTS 최신순)", async () => {
    const ids = async (o: Parameters<Feeds["searchFeeds"]>[0]) =>
      (await f.searchFeeds(o)).items.map((i) => i.slug);
    expect(await ids({ role: "anon" })).toEqual(["sched", "normal"]);
    expect(await ids({ role: "anon", q: "본문" })).toEqual(["sched", "normal"]);
    expect(await ids({ role: "anon", q: "검색어", sort: "latest" })).toEqual([
      "sched",
      "normal",
    ]);
  });

  test("목록 카드 날짜는 게시일", async () => {
    const { items } = await f.searchFeeds({ role: "anon" });
    expect(items[0].publishedAt?.toISOString()).toBe(
      "2026-03-01T00:00:00.000Z",
    );
  });

  test("태그 목록·아카이브도 게시 시각 기준", async () => {
    expect((await f.getFeedsByTag("po", "anon")).map((i) => i.slug)).toEqual([
      "sched",
      "normal",
    ]);
    const archive = await f.getArchiveFeeds("anon");
    expect(archive.map((i) => i.slug)).toEqual(["sched", "normal"]);
    expect(archive[0].publishedAt?.toISOString()).toBe(
      "2026-03-01T00:00:00.000Z",
    );
  });

  test("이전/다음: 일반글(2월 게시)의 다음 글은 예약글(3월 게시)", async () => {
    const normal = await prisma.feed.findUnique({ where: { id: "normal" } });
    const { prev, next } = await f.getAdjacentFeeds(normal!, "anon");
    expect(next?.slug).toBe("sched");
    expect(prev).toBeNull();
  });

  test("RSS: 게시 시각 순서·pubDate", async () => {
    const xml = await (
      await (await import("@/app/rss.xml/route")).GET()
    ).text();
    expect(xml.indexOf("예약글")).toBeLessThan(xml.indexOf("일반글"));
    expect(xml).toContain("<pubDate>Sun, 01 Mar 2026 00:00:00 GMT</pubDate>");
    expect(xml).not.toContain("Thu, 01 Jan 2026");
  });

  test("llms.txt: 게시 시각 순서", async () => {
    const txt = await (
      await (await import("@/app/llms.txt/route")).GET()
    ).text();
    expect(txt.indexOf("예약글")).toBeLessThan(txt.indexOf("일반글"));
  });
});
