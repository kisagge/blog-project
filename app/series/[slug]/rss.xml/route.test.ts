import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";

type Route = typeof import("@/app/series/[slug]/rss.xml/route");
let GET: Route["GET"];
let prisma: Awaited<ReturnType<typeof setupTestDb>>["prisma"];
let cleanup: () => Promise<void>;

function call(slug: string) {
  return GET(new Request(`https://x/series/${slug}/rss.xml`), {
    params: Promise.resolve({ slug }),
  });
}

beforeAll(async () => {
  const db = await setupTestDb();
  cleanup = db.cleanup;
  prisma = db.prisma;
  const s = await prisma.series.create({
    data: { slug: "my-series", title: "내 시리즈" },
  });
  const empty = await prisma.series.create({
    data: { slug: "empty-series", title: "빈 시리즈" },
  });
  await prisma.feed.create({
    data: {
      slug: "s-pub",
      title: "공개시리즈글",
      content: "c",
      visibility: "public",
      status: "published",
      seriesId: s.id,
      seriesOrder: 0,
    },
  });
  await prisma.feed.create({
    data: {
      slug: "s-mem",
      title: "회원시리즈글",
      content: "c",
      visibility: "members", // anon RSS에서 제외
      status: "published",
      seriesId: s.id,
      seriesOrder: 1,
    },
  });
  await prisma.feed.create({
    data: {
      slug: "s-hid",
      title: "숨김시리즈글",
      content: "c",
      visibility: "public",
      status: "published",
      hiddenAt: new Date(), // 신고 숨김 → 제외
      seriesId: s.id,
      seriesOrder: 2,
    },
  });
  await prisma.feed.create({
    data: {
      slug: "e-priv",
      title: "비공개글",
      content: "c",
      visibility: "private", // empty 시리즈엔 공개 글 0
      status: "published",
      seriesId: empty.id,
      seriesOrder: 0,
    },
  });
  ({ GET } = await import("@/app/series/[slug]/rss.xml/route"));
});
afterAll(async () => {
  await cleanup();
});

describe("series rss.xml", () => {
  test("공개 글만 포함, 회원공개·숨김 글 제외", async () => {
    const res = await call("my-series");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/rss+xml");
    const xml = await res.text();
    expect(xml).toContain("내 시리즈");
    expect(xml).toContain("공개시리즈글");
    expect(xml).not.toContain("회원시리즈글");
    expect(xml).not.toContain("숨김시리즈글");
  });

  test("없는 슬러그 → 404", async () => {
    expect((await call("nope")).status).toBe(404);
  });

  test("공개 글 0개 시리즈 → 404(은닉)", async () => {
    expect((await call("empty-series")).status).toBe(404);
  });
});
