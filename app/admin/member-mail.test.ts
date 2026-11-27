// @vitest-environment node
// 승인·거절 결과 메일: 처리 후 신청자에게 알리고, 메일 실패는 승인·거절을 막지 않는다.
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/dal", () => ({ verifySession: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/users", () => ({
  approveUser: vi.fn(),
  rejectUser: vi.fn(),
  blockUser: vi.fn(),
  unblockUser: vi.fn(),
}));
vi.mock("@/lib/mailer", () => ({ sendSignupResult: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async () => ({ email: "a@x.com", nickname: "신청자" })),
    },
  },
}));

import {
  approveUserAction,
  rejectUserAction,
} from "@/app/admin/member-actions";
import { approveUser, rejectUser } from "@/lib/users";
import { sendSignupResult } from "@/lib/mailer";
import { formData } from "@/test/helpers";

beforeEach(() => vi.clearAllMocks());

describe("가입 결과 메일", () => {
  test("승인 → 승인 메일", async () => {
    await approveUserAction(formData({ id: "u1" }));
    expect(approveUser).toHaveBeenCalledWith("u1");
    expect(sendSignupResult).toHaveBeenCalledWith(
      "a@x.com",
      "신청자",
      "approved",
    );
  });

  test("거절 → 거절 메일(사유는 전달하지 않음)", async () => {
    await rejectUserAction(formData({ id: "u1", reason: "내부 사유" }));
    expect(rejectUser).toHaveBeenCalledWith("u1", "내부 사유");
    expect(sendSignupResult).toHaveBeenCalledWith(
      "a@x.com",
      "신청자",
      "rejected",
    );
  });

  test("메일 전송 실패해도 승인은 완료(예외 전파 없음)", async () => {
    vi.mocked(sendSignupResult).mockRejectedValueOnce(new Error("smtp down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      approveUserAction(formData({ id: "u1" })),
    ).resolves.toBeUndefined();
    expect(approveUser).toHaveBeenCalled();
    err.mockRestore();
  });
});
