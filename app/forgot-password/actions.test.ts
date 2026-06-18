import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: vi.fn() }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: vi.fn(async () => "1.2.3.4") }));
vi.mock("@/lib/password-reset", () => ({
  requestPasswordReset: vi.fn(),
  verifyResetCode: vi.fn(),
  resetPassword: vi.fn(),
}));
vi.mock("@/lib/reset-token", () => ({
  setResetCookie: vi.fn(),
  getResetCookie: vi.fn(),
  clearResetCookie: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const e = new Error("NEXT_REDIRECT") as Error & { url?: string };
    e.url = url;
    throw e;
  }),
}));

import {
  requestCode,
  verifyCode,
  submitNewPassword,
} from "@/app/forgot-password/actions";
import { verifyTurnstile } from "@/lib/turnstile";
import {
  requestPasswordReset,
  verifyResetCode,
  resetPassword,
} from "@/lib/password-reset";
import {
  setResetCookie,
  getResetCookie,
  clearResetCookie,
} from "@/lib/reset-token";
import { redirect } from "next/navigation";

const vt = vi.mocked(verifyTurnstile);
const rpr = vi.mocked(requestPasswordReset);
const vrc = vi.mocked(verifyResetCode);
const rp = vi.mocked(resetPassword);
const setCk = vi.mocked(setResetCookie);
const getCk = vi.mocked(getResetCookie);
const clearCk = vi.mocked(clearResetCookie);
const rd = vi.mocked(redirect);

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}
const EXPIRES = new Date("2099-01-01T00:00:00.000Z");

beforeEach(() => {
  vt.mockReset();
  rpr.mockReset();
  vrc.mockReset();
  rp.mockReset();
  setCk.mockReset();
  getCk.mockReset();
  clearCk.mockReset();
  rd.mockClear();
});

describe("requestCode (1단계)", () => {
  test("turnstile 실패 → error", async () => {
    vt.mockResolvedValue(false);
    expect(await requestCode(undefined, fd({ email: "a@x.com" }))).toEqual({
      error: "사람 확인에 실패했습니다. 다시 시도해 주세요.",
    });
  });

  test("잘못된 이메일 → error, 코드 요청 미진행", async () => {
    vt.mockResolvedValue(true);
    expect(await requestCode(undefined, fd({ email: "not-email" }))).toEqual({
      error: "올바른 이메일을 입력하세요.",
    });
    expect(rpr).not.toHaveBeenCalled();
  });

  test("성공 → setResetCookie(verified:false) + redirect(verify)", async () => {
    vt.mockResolvedValue(true);
    rpr.mockResolvedValue({ expiresAt: EXPIRES });
    await expect(
      requestCode(undefined, fd({ email: "a@x.com" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(setCk).toHaveBeenCalledWith(
      expect.objectContaining({ email: "a@x.com", verified: false }),
    );
    expect(rd).toHaveBeenCalledWith("/forgot-password/verify");
  });
});

describe("verifyCode (2단계)", () => {
  test("쿠키 없음 → redirect(forgot-password)", async () => {
    getCk.mockResolvedValue(undefined);
    await expect(verifyCode(undefined, fd({ code: "123456" }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(rd).toHaveBeenCalledWith("/forgot-password");
  });

  test("코드 형식 오류 → error", async () => {
    getCk.mockResolvedValue({ email: "a@x.com", expiresAt: "", verified: false });
    expect(await verifyCode(undefined, fd({ code: "12" }))).toEqual({
      error: "6자리 숫자 코드를 입력하세요.",
    });
  });

  test("코드 불일치 → error(verifyResetCode 결과)", async () => {
    getCk.mockResolvedValue({ email: "a@x.com", expiresAt: "", verified: false });
    vrc.mockResolvedValue({ ok: false, error: "코드가 일치하지 않습니다." });
    expect(await verifyCode(undefined, fd({ code: "123456" }))).toEqual({
      error: "코드가 일치하지 않습니다.",
    });
  });

  test("성공 → setResetCookie(verified:true) + redirect(reset)", async () => {
    getCk.mockResolvedValue({ email: "a@x.com", expiresAt: "", verified: false });
    vrc.mockResolvedValue({ ok: true });
    await expect(
      verifyCode(undefined, fd({ code: "123456" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(setCk).toHaveBeenCalledWith(
      expect.objectContaining({ email: "a@x.com", verified: true }),
    );
    expect(rd).toHaveBeenCalledWith("/forgot-password/reset");
  });
});

describe("submitNewPassword (3단계)", () => {
  test("미인증 쿠키 → redirect(forgot-password)", async () => {
    getCk.mockResolvedValue({ email: "a@x.com", expiresAt: "", verified: false });
    await expect(
      submitNewPassword(undefined, fd({ password: "Abcdef1!", confirm: "Abcdef1!" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(rd).toHaveBeenCalledWith("/forgot-password");
  });

  test("비밀번호 불일치 → zod 필드 에러", async () => {
    getCk.mockResolvedValue({ email: "a@x.com", expiresAt: "", verified: true });
    const r = await submitNewPassword(
      undefined,
      fd({ password: "Abcdef1!", confirm: "Different1!" }),
    );
    expect(r?.errors?.confirm?.length).toBeGreaterThan(0);
    expect(rp).not.toHaveBeenCalled();
  });

  test("성공 → clearResetCookie + redirect(signin?reset=1)", async () => {
    getCk.mockResolvedValue({ email: "a@x.com", expiresAt: "", verified: true });
    rp.mockResolvedValue({ ok: true });
    await expect(
      submitNewPassword(undefined, fd({ password: "Abcdef1!", confirm: "Abcdef1!" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(clearCk).toHaveBeenCalled();
    expect(rd).toHaveBeenCalledWith("/signin?reset=1");
  });
});
