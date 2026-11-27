// @vitest-environment node
// 신고 처리 액션: 대상·글 주소는 DB 값으로(클라이언트 인자 불신), 숨김·해제 시 회원 작성자에게 알림.
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/dal", () => ({ verifySession: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/events", () => ({ publishReports: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ notifyContentModeration: vi.fn() }));
vi.mock("@/lib/reports", () => ({
  hideTarget: vi.fn(),
  unhideTarget: vi.fn(),
  dismissReports: vi.fn(),
  countPendingReportTargets: vi.fn(async () => 0),
  findReportTarget: vi.fn(),
}));

import {
  dismissReportsAction,
  hideTargetAction,
  unhideTargetAction,
} from "@/app/admin/reports/actions";
import { hideTarget, unhideTarget, findReportTarget } from "@/lib/reports";
import { notifyContentModeration } from "@/lib/notifications";
import { revalidatePath } from "next/cache";

const info = (over = {}) => ({
  targetType: "comment" as const,
  targetId: "c1",
  slug: "real-slug",
  authorId: "u1",
  preview: "",
  authorNickname: "작성자",
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe("신고 처리 액션", () => {
  test("숨김: DB의 글 주소로 화면 갱신 + 작성자에게 알림", async () => {
    vi.mocked(hideTarget).mockResolvedValue(info());
    await hideTargetAction("comment", "c1");
    expect(revalidatePath).toHaveBeenCalledWith("/feed/real-slug");
    expect(notifyContentModeration).toHaveBeenCalledWith({
      userId: "u1",
      targetType: "comment",
      targetId: "c1",
      slug: "real-slug",
      hidden: true,
    });
  });

  test("숨김 해제: 다시 공개 알림", async () => {
    vi.mocked(unhideTarget).mockResolvedValue(
      info({ targetType: "feed", targetId: "f1" }),
    );
    await unhideTargetAction("feed", "f1");
    expect(notifyContentModeration).toHaveBeenCalledWith(
      expect.objectContaining({ targetType: "feed", hidden: false }),
    );
  });

  test("작성자가 회원이 아니면(관리자·탈퇴) 알리지 않음, 없는 대상·잘못된 종류는 무시", async () => {
    vi.mocked(hideTarget).mockResolvedValue(info({ authorId: null }));
    await hideTargetAction("comment", "c1");
    vi.mocked(hideTarget).mockResolvedValue(null);
    await hideTargetAction("comment", "nope");
    await hideTargetAction("user", "x");
    expect(notifyContentModeration).not.toHaveBeenCalled();
    expect(hideTarget).toHaveBeenCalledTimes(2);
  });

  test("기각: 알림 없음, 화면 갱신은 DB 주소로", async () => {
    vi.mocked(findReportTarget).mockResolvedValue(info());
    await dismissReportsAction("comment", "c1");
    expect(notifyContentModeration).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/feed/real-slug");
  });
});
