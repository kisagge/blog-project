// 점검 모드에서 페이지 가드(/maintenance 리다이렉트)를 거치지 않는 공개 응답들 — RSS·시리즈 RSS·
// llms.txt·sitemap·OG 이미지 — 이 글 목록·본문·제목을 내보내지 않는지 실제 DB로 검증.
import { vi } from "vitest";
vi.mock("server-only", () => ({}));
// OG 이미지는 렌더 대신 제목만 기록
const ogTitles: string[] = [];
vi.mock("@/lib/og", () => ({
  OG_SIZE: { width: 1200, height: 630 },
  OG_CONTENT_TYPE: "image/png",
  ogImage: vi.fn(async (title: string) => {
    ogTitles.push(title);
    return new Response("png");
  }),
}));
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { setupTestDb } from "@/lib/test-db";

const SECRET_TITLE = "점검중노출되면안되는제목";
let prisma: Awaited<ReturnType<typeof setupTestDb>>["prisma"];
let cleanup: () => Promise<void>;

const setPublic = (publicEnabled: boolean) =>
  prisma.siteConfig.upsert({
    where: { id: 1 },
    update: { publicEnabled },
    create: { id: 1, publicEnabled },
  });

async function surfaces() {
  const rss = await (await import("@/app/rss.xml/route")).GET();
  const seriesRss = await (
    await import("@/app/series/[slug]/rss.xml/route")
  ).GET(new Request("https://x/series/mt-series/rss.xml"), {
    params: Promise.resolve({ slug: "mt-series" }),
  });
  const llms = await (await import("@/app/llms.txt/route")).GET();
  const sitemap = await (await import("@/app/sitemap")).default();
  ogTitles.length = 0;
  await (
    await import("@/app/feed/[slug]/opengraph-image")
  ).default({
    params: Promise.resolve({ slug: "mt-post" }),
  });
  await (
    await import("@/app/feed/tags/[slug]/opengraph-image")
  ).default({
    params: Promise.resolve({ slug: "mt-tag" }),
  });
  return { rss, seriesRss, llms, sitemap, og: [...ogTitles] };
}

beforeAll(async () => {
  const db = await setupTestDb();
  prisma = db.prisma;
  cleanup = db.cleanup;
  const series = await prisma.series.create({
    data: { slug: "mt-series", title: "점검시리즈" },
  });
  const tag = await prisma.tag.create({
    data: { slug: "mt-tag", name: "점검태그" },
  });
  const feed = await prisma.feed.create({
    data: {
      slug: "mt-post",
      title: SECRET_TITLE,
      content: "본문",
      visibility: "public",
      status: "published",
      seriesId: series.id,
    },
  });
  await prisma.feedTag.create({ data: { feedId: feed.id, tagId: tag.id } });
});
afterAll(async () => {
  await cleanup();
});
beforeEach(() => vi.resetModules());

describe("점검 모드 공개 응답", () => {
  test("평상시엔 글이 노출됨(대조군)", async () => {
    await setPublic(true);
    const s = await surfaces();
    expect(await s.rss.text()).toContain(SECRET_TITLE);
    expect(await s.seriesRss.text()).toContain(SECRET_TITLE);
    expect(await s.llms.text()).toContain(SECRET_TITLE);
    expect(s.sitemap.some((e) => e.url.endsWith("/feed/mt-post"))).toBe(true);
    expect(s.og).toEqual([SECRET_TITLE, "#점검태그"]);
  });

  test("점검 중: RSS·시리즈 RSS·llms.txt는 503 + Retry-After, 본문에 글 없음", async () => {
    await setPublic(false);
    const s = await surfaces();
    for (const res of [s.rss, s.seriesRss, s.llms]) {
      expect(res.status).toBe(503);
      expect(res.headers.get("Retry-After")).toBe("3600");
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      expect(await res.text()).not.toContain(SECRET_TITLE);
    }
  });

  test("점검 중: sitemap은 빈 목록, OG 이미지는 기본 카드", async () => {
    await setPublic(false);
    const s = await surfaces();
    expect(s.sitemap).toEqual([]);
    expect(s.og).toEqual(["BY Playground", "BY Playground"]);
  });
});
