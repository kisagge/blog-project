import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";
import { kstDay } from "@/lib/kst";

type Mod = typeof import("@/lib/read-metrics");
let m: Mod;
let prisma: Awaited<ReturnType<typeof setupTestDb>>["prisma"];
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const db = await setupTestDb();
  prisma = db.prisma;
  cleanup = db.cleanup;
  m = await import("@/lib/read-metrics");
});
afterAll(async () => {
  await cleanup();
});

const view = (visitorId: string, entityId = "f1", day = kstDay()) =>
  prisma.view.create({
    data: { entityType: "feed", entityId, visitorId, day },
  });
const read = (visitorId: string, entityId = "f1") =>
  prisma.view.findFirstOrThrow({
    where: { entityType: "feed", entityId, visitorId },
  });

describe("recordRead", () => {
  test("오늘 조회 기록에 깊이는 최댓값, 시간은 누적으로 반영", async () => {
    await view("v1");
    expect(
      await m.recordRead("v1", { feedId: "f1", depth: 40, seconds: 30 }),
    ).toBe(true);
    await m.recordRead("v1", { feedId: "f1", depth: 20, seconds: 15 }); // 위로 스크롤해도 깊이 유지
    const row = await read("v1");
    expect(row.scrollDepth).toBe(40);
    expect(row.activeSeconds).toBe(45);
  });

  test("활성 시간은 하루 상한에서 멈춤", async () => {
    await view("v2");
    for (let i = 0; i < 8; i++)
      await m.recordRead("v2", {
        feedId: "f1",
        depth: 100,
        seconds: m.MAX_BEACON_SECONDS,
      });
    expect((await read("v2")).activeSeconds).toBe(m.MAX_ACTIVE_SECONDS);
  });

  test("조회 기록이 없으면(다른 날·다른 글·모르는 방문자) 아무것도 만들지 않음", async () => {
    await view("v3", "f1", "2000-01-01");
    expect(
      await m.recordRead("v3", { feedId: "f1", depth: 50, seconds: 5 }),
    ).toBe(false);
    expect(
      await m.recordRead("nobody", { feedId: "f1", depth: 50, seconds: 5 }),
    ).toBe(false);
    expect(await prisma.view.count({ where: { visitorId: "nobody" } })).toBe(0);
    expect((await read("v3")).scrollDepth).toBeNull();
  });

  test("df 조회 기록은 대상 아님(feed만)", async () => {
    await prisma.view.create({
      data: {
        entityType: "df",
        entityId: "f1",
        visitorId: "v4",
        day: kstDay(),
      },
    });
    expect(
      await m.recordRead("v4", { feedId: "f1", depth: 50, seconds: 5 }),
    ).toBe(false);
  });
});

describe("ReadBeaconSchema", () => {
  test("범위 밖·정수 아님·과대 증분 거부", () => {
    const ok = { feedId: "f1", depth: 50, seconds: 10 };
    expect(m.ReadBeaconSchema.safeParse(ok).success).toBe(true);
    for (const bad of [
      { ...ok, depth: 101 },
      { ...ok, depth: -1 },
      { ...ok, seconds: 1.5 },
      { ...ok, seconds: m.MAX_BEACON_SECONDS + 1 },
      { ...ok, feedId: "" },
    ])
      expect(m.ReadBeaconSchema.safeParse(bad).success).toBe(false);
  });
});
