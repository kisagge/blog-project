import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";

type Route = typeof import("@/app/rss.xml/route");
let GET: Route["GET"];
let prisma: Awaited<ReturnType<typeof setupTestDb>>["prisma"];
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const db = await setupTestDb();
  cleanup = db.cleanup;
  prisma = db.prisma;
  await prisma.feed.create({
    data: {
      slug: "rss-visible",
      title: "보이는글RSS",
      content: "c",
      visibility: "public",
      status: "published",
    },
  });
  await prisma.feed.create({
    data: {
      slug: "rss-hidden",
      title: "가려진글RSS",
      summary: "민감한요약",
      content: "c",
      visibility: "public",
      status: "published",
      hiddenAt: new Date(), // 신고로 숨김
    },
  });
  ({ GET } = await import("@/app/rss.xml/route"));
});
afterAll(async () => {
  await cleanup();
});

describe("rss.xml", () => {
  test("신고로 가려진 글은 RSS에서 제외(제목·요약 노출 안 됨)", async () => {
    const xml = await (await GET()).text();
    expect(xml).toContain("보이는글RSS");
    expect(xml).not.toContain("가려진글RSS");
    expect(xml).not.toContain("민감한요약");
  });
});
