import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/comment-actor", () => ({ getCommentActor: vi.fn() }));
vi.mock("@/lib/reports", () => ({
  createReport: vi.fn(),
  countPendingReportTargets: vi.fn(async () => 0),
}));
vi.mock("@/lib/notifications", () => ({ notifyAdminReport: vi.fn() }));
vi.mock("@/lib/events", () => ({ publishReports: vi.fn() }));

import { submitReportAction } from "@/app/report/report-actions";
import { getCommentActor } from "@/lib/comment-actor";
import { createReport } from "@/lib/reports";
import { ACTION_LIMITS, TOO_MANY_REQUESTS } from "@/lib/rate-limit";

const gca = vi.mocked(getCommentActor);
const cr = vi.mocked(createReport);

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}
const ARGS = { targetType: "comment" as const, targetId: "c1" };

beforeEach(() => {
  gca.mockReset();
  cr.mockReset();
});

describe("submitReportAction", () => {
  test("비로그인 → error", async () => {
    gca.mockResolvedValue(null);
    expect(await submitReportAction(ARGS, fd({ reason: "spam" }))).toEqual({
      error: "로그인이 필요합니다.",
    });
    expect(cr).not.toHaveBeenCalled();
  });

  test("정상 신고 → { ok: true }", async () => {
    gca.mockResolvedValue({ userId: "u1", nickname: "n", role: "member" });
    cr.mockResolvedValue({ ok: true, created: true, firstForTarget: false });
    expect(await submitReportAction(ARGS, fd({ reason: "spam" }))).toEqual({
      ok: true,
    });
  });

  test("레이트리밋: 회원당 한도 초과 시 차단", async () => {
    gca.mockResolvedValue({
      userId: "rl-report",
      nickname: "n",
      role: "member",
    });
    cr.mockResolvedValue({ ok: true, created: true, firstForTarget: false });
    const { limit } = ACTION_LIMITS.report;
    for (let i = 0; i < limit; i++) {
      expect(await submitReportAction(ARGS, fd({ reason: "spam" }))).toEqual({
        ok: true,
      });
    }
    expect(await submitReportAction(ARGS, fd({ reason: "spam" }))).toEqual({
      error: TOO_MANY_REQUESTS,
    });
  });
});
