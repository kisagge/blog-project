import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/comment-actor", () => ({ getCommentActor: vi.fn() }));
vi.mock("@/lib/reports", () => ({
  createReport: vi.fn(),
  countPendingReportTargets: vi.fn(async () => 0),
}));
vi.mock("@/lib/notifications", () => ({ notifyAdminReport: vi.fn() }));
vi.mock("@/lib/events", () => ({ publishReports: vi.fn() }));
vi.mock("@/lib/dal", () => ({ getViewerRole: vi.fn(async () => "member") }));
vi.mock("@/lib/feed-access", () => ({
  getReadableFeed: vi.fn(async () => ({ id: "f1", slug: "s" })),
  getReadableCommentFeed: vi.fn(async () => ({ id: "f1", slug: "s" })),
}));

import { submitReportAction } from "@/app/report/report-actions";
import { getCommentActor } from "@/lib/comment-actor";
import { createReport } from "@/lib/reports";
import { ACTION_LIMITS, TOO_MANY_REQUESTS } from "@/lib/rate-limit";
import { formData } from "@/test/helpers";

const gca = vi.mocked(getCommentActor);
const cr = vi.mocked(createReport);

const ARGS = { targetType: "comment" as const, targetId: "c1" };

beforeEach(() => {
  gca.mockReset();
  cr.mockReset();
});

describe("submitReportAction", () => {
  test("비로그인 → error", async () => {
    gca.mockResolvedValue(null);
    expect(
      await submitReportAction(ARGS, formData({ reason: "spam" })),
    ).toEqual({
      error: "로그인이 필요합니다.",
    });
    expect(cr).not.toHaveBeenCalled();
  });

  test("정상 신고 → { ok: true }", async () => {
    gca.mockResolvedValue({ userId: "u1", nickname: "n", role: "member" });
    cr.mockResolvedValue({ ok: true, created: true, firstForTarget: false });
    expect(
      await submitReportAction(ARGS, formData({ reason: "spam" })),
    ).toEqual({
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
      expect(
        await submitReportAction(ARGS, formData({ reason: "spam" })),
      ).toEqual({
        ok: true,
      });
    }
    expect(
      await submitReportAction(ARGS, formData({ reason: "spam" })),
    ).toEqual({
      error: TOO_MANY_REQUESTS,
    });
  });
});

describe("신고 대상 검증(서버 액션 인자는 임의 값일 수 있음)", () => {
  test("허용되지 않은 대상 종류는 신고를 만들지 않음(관리자 알림 남발·처리 불가 신고 방지)", async () => {
    gca.mockResolvedValue({ userId: "u-type", nickname: "n", role: "member" });
    const r = await submitReportAction(
      { targetType: "x1" as never, targetId: "f1" },
      formData({ reason: "spam" }),
    );
    expect(r).toEqual({ error: "신고할 수 없는 대상입니다." });
    expect(cr).not.toHaveBeenCalled();
  });

  test("신고자가 볼 수 없는 대상(비공개·숨김·다른 글의 댓글 등)은 거부", async () => {
    const { getReadableCommentFeed } = await import("@/lib/feed-access");
    vi.mocked(getReadableCommentFeed).mockResolvedValueOnce(null);
    gca.mockResolvedValue({ userId: "u-read", nickname: "n", role: "member" });
    expect(
      await submitReportAction(ARGS, formData({ reason: "spam" })),
    ).toEqual({ error: "신고할 수 없는 대상입니다." });
    expect(cr).not.toHaveBeenCalled();
  });
});
