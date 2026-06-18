import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: vi.fn() }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: vi.fn(async () => "1.2.3.4") }));
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
import { redirect } from "next/navigation";

const vt = vi.mocked(verifyTurnstile);
const am = vi.mocked(authenticateMember);
const cms = vi.mocked(createMemberSession);
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
  rd.mockClear();
});

describe("signin action", () => {
  test("turnstile 실패 → error, 인증·redirect 미호출", async () => {
    vt.mockResolvedValue(false);
    expect(await signin(undefined, fd({ email: "a@x.com", password: "x" }))).toEqual({
      error: "사람 확인에 실패했습니다. 다시 시도해 주세요.",
    });
    expect(am).not.toHaveBeenCalled();
    expect(rd).not.toHaveBeenCalled();
  });

  test("인증 실패 → error, 세션 미생성", async () => {
    vt.mockResolvedValue(true);
    am.mockResolvedValue({ ok: false, error: "이메일 또는 비밀번호가 올바르지 않습니다." });
    expect(await signin(undefined, fd({ email: "a@x.com", password: "x" }))).toEqual({
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
});
