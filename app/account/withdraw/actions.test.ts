// @vitest-environment node
// 회원 탈퇴 액션: 비밀번호 재확인·확인 체크·요청 제한을 통과해야만 탈퇴하고, 로그아웃 후 완료 화면으로.
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/dal", () => ({ getMemberSession: vi.fn() }));
vi.mock("@/lib/session", () => ({ deleteSession: vi.fn() }));
vi.mock("@/lib/users", () => ({ verifyMemberPassword: vi.fn() }));
vi.mock("@/lib/withdrawal", () => ({ withdrawMember: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

import { withdrawAction } from "@/app/account/withdraw/actions";
import { getMemberSession } from "@/lib/dal";
import { deleteSession } from "@/lib/session";
import { verifyMemberPassword } from "@/lib/users";
import { withdrawMember } from "@/lib/withdrawal";
import { redirect } from "next/navigation";
import { LOGIN_REQUIRED } from "@/lib/form-state";
import { TOO_MANY_REQUESTS, ACTION_LIMITS } from "@/lib/rate-limit";
import { formData } from "@/test/helpers";

const session = { role: "member", userId: "u1", nickname: "닉" } as never;
const valid = { password: "Aa1!aaaa", confirm: "on" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getMemberSession).mockResolvedValue(session);
  vi.mocked(verifyMemberPassword).mockResolvedValue(true);
  vi.mocked(withdrawMember).mockResolvedValue({ ok: true });
});

describe("withdrawAction", () => {
  test("비로그인 → 안내, 탈퇴 안 함", async () => {
    vi.mocked(getMemberSession).mockResolvedValue(null as never);
    expect(await withdrawAction(undefined, formData(valid))).toEqual({
      error: LOGIN_REQUIRED,
    });
    expect(withdrawMember).not.toHaveBeenCalled();
  });

  test("확인 체크 없으면 거부", async () => {
    const r = await withdrawAction(undefined, formData({ password: "x" }));
    expect(r?.errors?.confirm?.length).toBeGreaterThan(0);
    expect(withdrawMember).not.toHaveBeenCalled();
  });

  test("비밀번호가 틀리면 필드 오류, 탈퇴 안 함", async () => {
    vi.mocked(verifyMemberPassword).mockResolvedValue(false);
    const r = await withdrawAction(undefined, formData(valid));
    expect(r?.errors?.password).toEqual(["비밀번호가 올바르지 않습니다."]);
    expect(withdrawMember).not.toHaveBeenCalled();
  });

  test("성공: 글 보존(기본) → 로그아웃 → 완료 화면", async () => {
    await expect(withdrawAction(undefined, formData(valid))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(withdrawMember).toHaveBeenCalledWith("u1", { deletePosts: false });
    expect(deleteSession).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/withdrawn");
  });

  test("'글도 삭제' 선택 전달", async () => {
    await expect(
      withdrawAction(undefined, formData({ ...valid, deletePosts: "on" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(withdrawMember).toHaveBeenCalledWith("u1", { deletePosts: true });
  });

  test("비밀번호 대입 방지: 회원당 요청 제한", async () => {
    vi.mocked(getMemberSession).mockResolvedValue({
      ...(session as object),
      userId: "rl",
    } as never);
    vi.mocked(verifyMemberPassword).mockResolvedValue(false);
    for (let i = 0; i < ACTION_LIMITS.withdraw.limit; i++)
      await withdrawAction(undefined, formData(valid));
    expect(await withdrawAction(undefined, formData(valid))).toEqual({
      error: TOO_MANY_REQUESTS,
    });
  });
});
