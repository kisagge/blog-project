import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";

type Audit = typeof import("@/lib/audit");
let m: Audit;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const db = await setupTestDb();
  cleanup = db.cleanup;
  m = await import("@/lib/audit");
});

afterAll(async () => {
  await cleanup();
});

describe("logAudit / getAuditPage", () => {
  test("logAudit가 필드를 보존해 기록한다", async () => {
    await m.logAudit({
      action: "feed.delete",
      targetType: "feed",
      targetId: "f1",
      summary: "글 삭제: 테스트",
    });
    const { items, total } = await m.getAuditPage(1);
    expect(total).toBe(1);
    expect(items[0]).toMatchObject({
      action: "feed.delete",
      targetType: "feed",
      targetId: "f1",
      summary: "글 삭제: 테스트",
    });
  });

  test("targetId 없이도 기록(site/admin)", async () => {
    await m.logAudit({
      action: "site.public",
      targetType: "site",
      summary: "사이트 점검 모드 전환",
    });
    const { items } = await m.getAuditPage(1);
    expect(items[0].targetType).toBe("site");
    expect(items[0].targetId).toBeNull();
  });

  test("최신순 + 페이지네이션", async () => {
    // 위 2건 + 추가 → 총 5건, size 2.
    await m.logAudit({ action: "a", targetType: "feed", summary: "3" });
    await m.logAudit({ action: "b", targetType: "feed", summary: "4" });
    await m.logAudit({ action: "c", targetType: "feed", summary: "5" });
    const p1 = await m.getAuditPage(1, 2);
    expect(p1.total).toBe(5);
    expect(p1.items).toHaveLength(2);
    expect(p1.items[0].summary).toBe("5"); // 최신 먼저
    const p3 = await m.getAuditPage(3, 2);
    expect(p3.items).toHaveLength(1);
  });
});
