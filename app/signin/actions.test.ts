import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: vi.fn() }));
vi.mock("@/lib/client-ip", () => ({
  getClientIp: vi.fn(async () => "1.2.3.4"),
}));
vi.mock("@/lib/users", () => ({ authenticateMember: vi.fn() }));
vi.mock("@/lib/session", () => ({ createMemberSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const e = new Error("NEXT_REDIRECT") as Error & { url?: string };
    e.url = url;
    throw e;
  }),
}));

import { signin } from "@/app/signin/actions";
import { verifyTurnstile } from "@/lib/turnstile";
import { authenticateMember } from "@/lib/users";
import { createMemberSession } from "@/lib/session";
import { getClientIp } from "@/lib/client-ip";
import { ACTION_LIMITS, TOO_MANY_REQUESTS } from "@/lib/rate-limit";
import { redirect } from "next/navigation";

const vt = vi.mocked(verifyTurnstile);
const am = vi.mocked(authenticateMember);
const cms = vi.mocked(createMemberSession);
const gci = vi.mocked(getClientIp);
const rd = vi.mocked(redirect);

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vt.mockReset();
  am.mockReset();
  cms.mockReset();
  gci.mockReset();
  gci.mockResolvedValue("1.2.3.4");
  rd.mockClear();
});

describe("signin action", () => {
  test("turnstile 실패 → error, 인증·redirect 미호출", async () => {
    vt.mockResolvedValue(false);
    expect(
      await signin(undefined, fd({ email: "a@x.com", password: "x" })),
    ).toEqual({
      error: "사람 확인에 실패했습니다. 다시 시도해 주세요.",
    });
    expect(am).not.toHaveBeenCalled();
    expect(rd).not.toHaveBeenCalled();
  });

  test("인증 실패 → error, 세션 미생성", async () => {
    vt.mockResolvedValue(true);
    am.mockResolvedValue({
      ok: false,
      error: "이메일 또는 비밀번호가 올바르지 않습니다.",
    });
    expect(
      await signin(undefined, fd({ email: "a@x.com", password: "x" })),
    ).toEqual({
      error: "이메일 또는 비밀번호가 올바르지 않습니다.",
    });
    expect(cms).not.toHaveBeenCalled();
  });

  test("성공 → createMemberSession(id,nick) + redirect('/')", async () => {
    vt.mockResolvedValue(true);
    am.mockResolvedValue({ ok: true, user: { id: "u1", nickname: "닉" } });
    await expect(
      signin(undefined, fd({ email: "a@x.com", password: "x" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(cms).toHaveBeenCalledWith("u1", "닉");
    expect(rd).toHaveBeenCalledWith("/");
  });

  test("레이트리밋: IP당 한도 초과 시 turnstile 전에 차단", async () => {
    gci.mockResolvedValue("rl-signin"); // 고유 IP로 격리
    vt.mockResolvedValue(false); // 한도 내 호출은 turnstile 에러
    const { limit } = ACTION_LIMITS.signin;
    for (let i = 0; i < limit; i++) {
      const r = await signin(
        undefined,
        fd({ email: "a@x.com", password: "x" }),
      );
      expect(r?.error).not.toBe(TOO_MANY_REQUESTS); // 게이트 통과
    }
    expect(
      await signin(undefined, fd({ email: "a@x.com", password: "x" })),
    ).toEqual({
      error: TOO_MANY_REQUESTS,
    });
  });
});
