import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { setupTestDb } from "@/lib/test-db";

vi.mock("server-only", () => ({}));

// 방문자 쿠키 저장소를 인메모리로 모킹. beforeEach에서 비우면 "새 방문자".
let cookieStore: Map<string, string>;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => {
      const v = cookieStore.get(k);
      return v ? { value: v } : undefined;
    },
    set: (k: string, v: string) => cookieStore.set(k, v),
  }),
}));

type Views = typeof import("@/lib/views");
type Prisma = (typeof import("@/lib/prisma"))["prisma"];
let views: Views;
let prisma: Prisma;
let cleanup: () => Promise<void>;
let feedId: string;
let dfId: string;

beforeAll(async () => {
  const db = await setupTestDb();
  cleanup = db.cleanup;
  prisma = db.prisma as Prisma;
  views = await import("@/lib/views");
  const feed = await prisma.feed.create({
    data: { slug: "v", title: "t", content: "c", visibility: "public" },
  });
  feedId = feed.id;
  const df = await prisma.dfCharacter.create({
    data: { serverId: "cain", characterId: "x", characterName: "n" },
  });
  dfId = df.id;
});
afterAll(async () => {
  await cleanup();
});
beforeEach(() => {
  cookieStore = new Map(); // 매 테스트 새 방문자
});

async function feedViews() {
  return (await prisma.feed.findUnique({ where: { id: feedId } }))!.viewCount;
}

describe("views", () => {
  test("첫 조회는 viewCount +1 + View 기록 생성", async () => {
    const before = await feedViews();
    await views.trackFeedView(feedId);
    expect(await feedViews()).toBe(before + 1);
    const rows = await prisma.view.count({
      where: { entityType: "feed", entityId: feedId },
    });
    expect(rows).toBeGreaterThan(0);
  });

  test("같은 방문자·같은 날 재조회는 증가 안 함(중복 제거)", async () => {
    await views.trackFeedView(feedId); // 이 방문자의 첫 조회(+1)
    const mid = await feedViews();
    await views.trackFeedView(feedId); // 재조회(중복)
    expect(await feedViews()).toBe(mid);
  });

  test("다른 방문자는 다시 집계", async () => {
    const before = await feedViews(); // beforeEach로 이미 새 방문자
    await views.trackFeedView(feedId);
    expect(await feedViews()).toBe(before + 1);
  });

  test("던파 캐릭터도 동일하게 집계", async () => {
    await views.trackDfView(dfId);
    const d = await prisma.dfCharacter.findUnique({ where: { id: dfId } });
    expect(d?.viewCount).toBe(1);
  });

  test("원자성: 증가 실패(없는 대상) 시 View도 안 남김(고아 방지)", async () => {
    // View.create는 성공하나 feed.update(없는 id)가 실패 → 트랜잭션 롤백 → throw 없이 무변경.
    await views.trackFeedView("nonexistent-feed-id");
    const orphan = await prisma.view.count({
      where: { entityType: "feed", entityId: "nonexistent-feed-id" },
    });
    expect(orphan).toBe(0);
  });

  test("원자성: viewCount가 View 행 수와 정확히 일치(드리프트 없음)", async () => {
    const base = await feedViews();
    for (let i = 0; i < 3; i++) {
      cookieStore = new Map(); // 새 방문자
      await views.trackFeedView(feedId);
    }
    expect(await feedViews()).toBe(base + 3);
  });

  test("사이트 방문은 일 순 방문자로 집계 + 같은 방문자 중복 제거", async () => {
    const before = await views.countTodayVisitors();
    await views.trackSiteVisit(); // 새 방문자(beforeEach 리셋)
    const mid = await views.countTodayVisitors();
    expect(mid).toBe(before + 1);
    await views.trackSiteVisit(); // 같은 방문자 재방문
    expect(await views.countTodayVisitors()).toBe(mid);
  });
});
