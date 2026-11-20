import { vi } from "vitest";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";
import { makeUser } from "@/lib/test-factories";

type Mod = typeof import("@/lib/retention");
let m: Mod;
let prisma: Awaited<ReturnType<typeof setupTestDb>>["prisma"];
let cleanup: () => Promise<void>;

const NOW = new Date("2026-11-20T00:00:00.000Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);
const kstDayOf = (d: Date) =>
  new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);

beforeAll(async () => {
  const db = await setupTestDb();
  prisma = db.prisma;
  cleanup = db.cleanup;
  const u = await makeUser(prisma);

  // View: 200일 전(삭제) / 20일 전(유지)
  for (const [id, d] of [
    ["v-old", 200],
    ["v-new", 20],
  ] as const)
    await prisma.view.create({
      data: {
        id,
        entityType: "feed",
        entityId: "f1",
        visitorId: id,
        day: kstDayOf(daysAgo(d)),
        createdAt: daysAgo(d),
      },
    });
  // 알림: 읽은 100일 전(삭제) / 읽은 30일 전(유지) / 안 읽은 100일 전(유지) / 안 읽은 400일 전(삭제)
  const notes: [string, number, boolean][] = [
    ["n-read-old", 100, true],
    ["n-read-new", 30, true],
    ["n-unread-100", 100, false],
    ["n-unread-400", 400, false],
  ];
  for (const [id, d, read] of notes)
    await prisma.notification.create({
      data: {
        id,
        userId: u.id,
        body: id,
        createdAt: daysAgo(d),
        readAt: read ? daysAgo(d) : null,
      },
    });
  // 감사 로그: 400일 전(삭제) / 300일 전(유지)
  for (const [id, d] of [
    ["a-old", 400],
    ["a-new", 300],
  ] as const)
    await prisma.auditLog.create({
      data: {
        id,
        action: "x",
        targetType: "site",
        summary: id,
        createdAt: daysAgo(d),
      },
    });
  // 재설정 코드: 2일 전(삭제) / 방금(유지 — 쿨다운·검증 유예에 필요)
  for (const [id, ms] of [
    ["r-old", 2 * 86_400_000],
    ["r-new", 60_000],
  ] as const)
    await prisma.passwordResetCode.create({
      data: {
        id,
        email: "x@x.com",
        codeHash: "-",
        createdAt: new Date(NOW.getTime() - ms),
        expiresAt: new Date(NOW.getTime() - ms + 180_000),
      },
    });
  m = await import("@/lib/retention");
});
afterAll(async () => {
  await cleanup();
});

const ids = async () => ({
  views: (await prisma.view.findMany()).map((r) => r.id).sort(),
  notes: (await prisma.notification.findMany()).map((r) => r.id).sort(),
  audits: (await prisma.auditLog.findMany()).map((r) => r.id).sort(),
  codes: (await prisma.passwordResetCode.findMany()).map((r) => r.id).sort(),
});

describe("pruneOldRecords", () => {
  test("보존 기간이 지난 행만 삭제하고 건수를 돌려줌", async () => {
    const res = await m.pruneOldRecords(NOW);
    expect(res).toEqual({
      views: 1,
      notifications: 2,
      auditLogs: 1,
      resetCodes: 1,
    });
    expect(await ids()).toEqual({
      views: ["v-new"],
      notes: ["n-read-new", "n-unread-100"],
      audits: ["a-new"],
      codes: ["r-new"],
    });
  });

  test("다시 돌려도 지울 것이 없으면 0(멱등)", async () => {
    expect(await m.pruneOldRecords(NOW)).toEqual({
      views: 0,
      notifications: 0,
      auditLogs: 0,
      resetCodes: 0,
    });
  });
});

describe("startRetentionScheduler", () => {
  afterEach(() => {
    m.stopRetentionScheduler();
    vi.useRealTimers();
  });

  test("부팅 직후가 아니라 지연 후 첫 실행, 이후 하루마다", () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => {});
    m.startRetentionScheduler(run, {
      firstDelayMs: 600_000,
      intervalMs: 86_400_000,
    });
    expect(run).not.toHaveBeenCalled(); // 기동 경합 회피
    vi.advanceTimersByTime(600_000);
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(86_400_000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  test("중복 시작 방지", () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => {});
    m.startRetentionScheduler(run, { firstDelayMs: 1000, intervalMs: 5000 });
    m.startRetentionScheduler(run, { firstDelayMs: 1000, intervalMs: 5000 });
    vi.advanceTimersByTime(6000);
    expect(run).toHaveBeenCalledTimes(2); // 지연 1회 + 인터벌 1회(중복 없음)
  });
});
