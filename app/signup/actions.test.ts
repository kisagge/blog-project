import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: vi.fn() }));
vi.mock("@/lib/client-ip", () => ({
  getClientIp: vi.fn(async () => "1.2.3.4"),
}));
vi.mock("@/lib/users", () => ({ createPendingUser: vi.fn() }));

import { signup } from "@/app/signup/actions";
import { verifyTurnstile } from "@/lib/turnstile";
import { createPendingUser } from "@/lib/users";
import { getClientIp } from "@/lib/client-ip";
import { ACTION_LIMITS, TOO_MANY_REQUESTS } from "@/lib/rate-limit";

const vt = vi.mocked(verifyTurnstile);
const cpu = vi.mocked(createPendingUser);
const gci = vi.mocked(getClientIp);

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}
const VALID = { email: "a@x.com", nickname: "닉", password: "Abcdef1!" };

beforeEach(() => {
  vt.mockReset();
  cpu.mockReset();
  gci.mockReset();
  gci.mockResolvedValue("1.2.3.4");
});

describe("signup action", () => {
  test("turnstile 실패 → error, 검증·생성 미진행", async () => {
    vt.mockResolvedValue(false);
    expect(await signup(undefined, fd(VALID))).toEqual({
      error: "사람 확인에 실패했습니다. 다시 시도해 주세요.",
    });
    expect(cpu).not.toHaveBeenCalled();
  });

  test("약한 비밀번호 → zod 필드 에러, createPendingUser 미호출", async () => {
    vt.mockResolvedValue(true);
    const r = await signup(undefined, fd({ ...VALID, password: "weak" }));
    expect(r?.errors?.password?.length).toBeGreaterThan(0);
    expect(cpu).not.toHaveBeenCalled();
  });

  test("createPendingUser 실패 → error", async () => {
    vt.mockResolvedValue(true);
    cpu.mockResolvedValue({ ok: false, error: "이미 가입 신청 중입니다." });
    expect(await signup(undefined, fd(VALID))).toEqual({
      error: "이미 가입 신청 중입니다.",
    });
  });

  test("성공 → { done: true }(redirect 없음)", async () => {
    vt.mockResolvedValue(true);
    cpu.mockResolvedValue({ ok: true });
    expect(await signup(undefined, fd(VALID))).toEqual({ done: true });
    expect(cpu).toHaveBeenCalledWith({
      email: "a@x.com",
      nickname: "닉",
      password: "Abcdef1!",
    });
  });

  test("레이트리밋: IP당 한도 초과 시 차단", async () => {
    gci.mockResolvedValue("rl-signup");
    vt.mockResolvedValue(false); // 한도 내 호출은 turnstile 에러
    const { limit } = ACTION_LIMITS.signup;
    for (let i = 0; i < limit; i++) {
      const r = await signup(undefined, fd(VALID));
      expect(r?.error).not.toBe(TOO_MANY_REQUESTS);
    }
    expect(await signup(undefined, fd(VALID))).toEqual({
      error: TOO_MANY_REQUESTS,
    });
  });
});
