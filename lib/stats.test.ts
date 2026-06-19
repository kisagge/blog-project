import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";
import { kstDay } from "@/lib/kst";

type Mod = typeof import("@/lib/stats");
let m: Mod;
let prisma: Awaited<ReturnType<typeof setupTestDb>>["prisma"];
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const db = await setupTestDb();
  prisma = db.prisma;
  cleanup = db.cleanup;
  m = await import("@/lib/stats");
});
afterAll(async () => {
  await cleanup();
});

describe("stats", () => {
  test("getViewTrend: 일별 피드 조회 집계 + 빈 날 0, df/site 제외", async () => {
    const today = kstDay();
    for (const vid of ["a", "b", "c"]) {
      await prisma.view.create({
        data: {
          entityType: "feed",
          entityId: "fX",
          visitorId: vid,
          day: today,
        },
      });
    }
    await prisma.view.create({
      data: { entityType: "df", entityId: "d1", visitorId: "a", day: today },
    });
    const trend = await m.getViewTrend(14);
    expect(trend).toHaveLength(14);
    expect(trend[trend.length - 1]).toEqual({ day: today, count: 3 });
    expect(trend[0].count).toBe(0); // 14일 전(빈 날)
  });

  test("getSignupTrend: 일별 가입(KST date) 집계, admin 제외, 빈 날 0", async () => {
    const today = kstDay();
    await prisma.user.create({
      data: {
        email: "su1@x.com",
        nickname: "S1",
        passwordHash: "-",
        role: "member",
      },
    });
    await prisma.user.create({
      data: {
        email: "su2@x.com",
        nickname: "S2",
        passwordHash: "-",
        role: "member",
      },
    });
    await prisma.user.create({
      data: {
        email: "ad@x.com",
        nickname: "AD",
        passwordHash: "-",
        role: "admin",
      },
    });
    const trend = await m.getSignupTrend(14);
    expect(trend).toHaveLength(14);
    expect(trend.find((p) => p.day === today)?.count).toBe(2); // admin 제외
    expect(trend[0].count).toBe(0);
  });

  test("getTopFeeds: 누적 조회순, 숨김/초안 제외", async () => {
    await prisma.feed.create({
      data: {
        slug: "t1",
        title: "T1",
        content: "c",
        visibility: "public",
        viewCount: 50,
      },
    });
    await prisma.feed.create({
      data: {
        slug: "t2",
        title: "T2",
        content: "c",
        visibility: "public",
        viewCount: 100,
      },
    });
    await prisma.feed.create({
      data: {
        slug: "t3",
        title: "T3",
        content: "c",
        visibility: "public",
        viewCount: 999,
        hiddenAt: new Date(),
      },
    });
    await prisma.feed.create({
      data: {
        slug: "t4",
        title: "T4",
        content: "c",
        visibility: "members",
        status: "draft",
        viewCount: 999,
      },
    });
    const top = await m.getTopFeeds(10);
    const slugs = top.map((f) => f.slug);
    expect(slugs.indexOf("t2")).toBeLessThan(slugs.indexOf("t1")); // 100 > 50
    expect(slugs).not.toContain("t3"); // 숨김
    expect(slugs).not.toContain("t4"); // 초안
  });

  test("getStatsSummary: 숫자 집계 반환", async () => {
    const s = await m.getStatsSummary();
    expect(typeof s.totalViews).toBe("number");
    expect(typeof s.members).toBe("number");
    expect(typeof s.comments).toBe("number");
    expect(s.feeds).toBeGreaterThanOrEqual(4); // 앞 테스트에서 만든 글
    expect(s.totalViews).toBeGreaterThanOrEqual(150); // t1+t2(+hidden/draft)
  });
});
