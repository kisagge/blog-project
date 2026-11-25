// @vitest-environment node
// 관리자 탈퇴 처리: 로그인할 수 없는 차단 회원의 탈퇴 요청을 대신 처리(이메일 재가입 차단은 withdrawMember가 담당).
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/dal", () => ({ verifySession: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/withdrawal", () => ({ withdrawMember: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async () => ({
        nickname: "차단회원",
        status: "blocked",
      })),
    },
  },
}));

import { withdrawMemberAction } from "@/app/admin/member-actions";
import { verifySession } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { withdrawMember } from "@/lib/withdrawal";
import { prisma } from "@/lib/prisma";
import { formData } from "@/test/helpers";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(withdrawMember).mockResolvedValue({ ok: true });
});

describe("withdrawMemberAction", () => {
  test("관리자 확인 → 차단 회원 탈퇴(글 보존) → 감사 기록", async () => {
    await withdrawMemberAction(formData({ id: "u9" }));
    expect(verifySession).toHaveBeenCalled();
    expect(withdrawMember).toHaveBeenCalledWith("u9", { deletePosts: false });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "member.withdraw", targetId: "u9" }),
    );
  });

  test("차단 회원이 아니면 처리하지 않음(본인이 직접 탈퇴)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      nickname: "보통회원",
      status: "approved",
    } as never);
    await withdrawMemberAction(formData({ id: "u1" }));
    expect(withdrawMember).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });
});
