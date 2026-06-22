import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";
import { makeFeed, makeUser } from "@/lib/test-factories";

type S = typeof import("@/lib/scheduled");
let s: S;
let prisma: Awaited<ReturnType<typeof setupTestDb>>["prisma"];
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const db = await setupTestDb();
  prisma = db.prisma;
  cleanup = db.cleanup;
  s = await import("@/lib/scheduled");
});
afterAll(async () => {
  await cleanup();
});

const past = new Date("2026-06-01T00:00:00Z");
const future = new Date("2030-01-01T00:00:00Z");

describe("decideSchedule (순수)", () => {
  const now = new Date("2026-06-22T00:00:00Z");
  test("빈값 → immediate", () => {
    expect(s.decideSchedule("", now).kind).toBe("immediate");
    expect(s.decideSchedule(undefined, now).kind).toBe("immediate");
  });
  test("미래 KST 벽시계 → scheduled(UTC 변환)", () => {
    const d = s.decideSchedule("2026-06-23T09:00", now);
    expect(d.kind).toBe("scheduled");
    if (d.kind === "scheduled")
      expect(d.at.toISOString()).toBe("2026-06-23T00:00:00.000Z");
  });
  test("과거 → error", () => {
    expect(s.decideSchedule("2026-06-21T09:00", now).kind).toBe("error");
  });
  test("무효 형식 → error", () => {
    expect(s.decideSchedule("nope", now).kind).toBe("error");
  });
});

describe("publishDueFeeds (통합)", () => {
  test("도래한 예약 draft만 게시, 미래/회원 draft는 불변", async () => {
    const due = await makeFeed(prisma, {
      status: "draft",
      visibility: "public",
      scheduledAt: past,
    });
    const notYet = await makeFeed(prisma, {
      status: "draft",
      visibility: "public",
      scheduledAt: future,
    });
    const u = await makeUser(prisma);
    const memberDraft = await makeFeed(prisma, {
      status: "draft",
      visibility: "members",
      authorId: u.id,
      scheduledAt: null, // 회원 임시저장(예약 아님)
    });

    const now = new Date("2026-06-22T00:00:00Z");
    const count = await s.publishDueFeeds(now);
    expect(count).toBe(1);

    const a = await prisma.feed.findUnique({ where: { id: due.id } });
    expect(a?.status).toBe("published");
    expect(a?.scheduledAt).toBeNull();
    expect(a?.publishedAt?.toISOString()).toBe(now.toISOString());

    const b = await prisma.feed.findUnique({ where: { id: notYet.id } });
    expect(b?.status).toBe("draft"); // 아직

    const c = await prisma.feed.findUnique({ where: { id: memberDraft.id } });
    expect(c?.status).toBe("draft"); // scheduledAt null이라 무관
  });
});

describe("startPublishScheduler (앱 내부 인터벌)", () => {
  afterEach(() => {
    s.stopPublishScheduler();
    vi.useRealTimers();
  });

  test("부팅 즉시 1회 + interval마다 호출", () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => 0);
    s.startPublishScheduler(1000, run);
    expect(run).toHaveBeenCalledTimes(1); // 즉시 1회
    vi.advanceTimersByTime(3000);
    expect(run).toHaveBeenCalledTimes(4); // +3회
  });

  test("중복 시작 방지(두 번 호출해도 인터벌 1개)", () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => 0);
    s.startPublishScheduler(1000, run);
    s.startPublishScheduler(1000, run); // 두 번째는 무시
    expect(run).toHaveBeenCalledTimes(1); // 즉시 호출도 1회뿐
    vi.advanceTimersByTime(2000);
    expect(run).toHaveBeenCalledTimes(3); // 인터벌 1개라 2회만 추가
  });
});
