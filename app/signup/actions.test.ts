import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: vi.fn() }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: vi.fn(async () => "1.2.3.4") }));
vi.mock("@/lib/users", () => ({ createPendingUser: vi.fn() }));

import { signup } from "@/app/signup/actions";
import { verifyTurnstile } from "@/lib/turnstile";
import { createPendingUser } from "@/lib/users";

const vt = vi.mocked(verifyTurnstile);
const cpu = vi.mocked(createPendingUser);

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}
const VALID = { email: "a@x.com", nickname: "닉", password: "Abcdef1!" };

beforeEach(() => {
  vt.mockReset();
  cpu.mockReset();
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
});
