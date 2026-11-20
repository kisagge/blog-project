import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: vi.fn() }));
vi.mock("@/lib/client-ip", () => ({
  getClientIp: vi.fn(async () => "1.2.3.4"),
}));
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
  resendCode,
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
import { getClientIp } from "@/lib/client-ip";
import { ACTION_LIMITS, TOO_MANY_REQUESTS } from "@/lib/rate-limit";
import { redirect } from "next/navigation";
import { formData } from "@/test/helpers";

const vt = vi.mocked(verifyTurnstile);
const gci = vi.mocked(getClientIp);
const rpr = vi.mocked(requestPasswordReset);
const vrc = vi.mocked(verifyResetCode);
const rp = vi.mocked(resetPassword);
const setCk = vi.mocked(setResetCookie);
const getCk = vi.mocked(getResetCookie);
const clearCk = vi.mocked(clearResetCookie);
const rd = vi.mocked(redirect);

const EXPIRES = new Date("2099-01-01T00:00:00.000Z");

beforeEach(() => {
  vt.mockReset();
  rpr.mockReset();
  vrc.mockReset();
  rp.mockReset();
  setCk.mockReset();
  getCk.mockReset();
  clearCk.mockReset();
  gci.mockReset();
  gci.mockResolvedValue("1.2.3.4");
  rd.mockClear();
});

describe("requestCode (1단계)", () => {
  test("turnstile 실패 → error", async () => {
    vt.mockResolvedValue(false);
    expect(
      await requestCode(undefined, formData({ email: "a@x.com" })),
    ).toEqual({
      error: "사람 확인에 실패했습니다. 다시 시도해 주세요.",
    });
  });

  test("레이트리밋: IP당 한도 초과 시 차단", async () => {
    gci.mockResolvedValue("rl-reset");
    vt.mockResolvedValue(false); // 한도 내 호출은 turnstile 에러
    const { limit } = ACTION_LIMITS.passwordReset;
    for (let i = 0; i < limit; i++) {
      const r = await requestCode(undefined, formData({ email: "a@x.com" }));
      expect(r?.error).not.toBe(TOO_MANY_REQUESTS);
    }
    expect(
      await requestCode(undefined, formData({ email: "a@x.com" })),
    ).toEqual({
      error: TOO_MANY_REQUESTS,
    });
  });

  test("잘못된 이메일 → error, 코드 요청 미진행", async () => {
    vt.mockResolvedValue(true);
    expect(
      await requestCode(undefined, formData({ email: "not-email" })),
    ).toEqual({
      error: "올바른 이메일을 입력하세요.",
    });
    expect(rpr).not.toHaveBeenCalled();
  });

  test("성공 → setResetCookie(verified:false) + redirect(verify)", async () => {
    vt.mockResolvedValue(true);
    rpr.mockResolvedValue({ expiresAt: EXPIRES });
    await expect(
      requestCode(undefined, formData({ email: "a@x.com" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(setCk).toHaveBeenCalledWith(
      expect.objectContaining({ email: "a@x.com", verified: false }),
    );
    expect(rd).toHaveBeenCalledWith("/forgot-password/verify");
  });
});

describe("이메일당 코드 발급 한도", () => {
  test("requestCode: 같은 이메일 반복 요청은 IP를 바꿔도 한도 초과 시 차단", async () => {
    vt.mockResolvedValue(true);
    rpr.mockResolvedValue({ expiresAt: EXPIRES });
    const { limit } = ACTION_LIMITS.resetIssue;
    for (let i = 0; i < limit; i++) {
      gci.mockResolvedValue(`issue-ip-${i}`);
      await expect(
        requestCode(undefined, formData({ email: "issue@x.com" })),
      ).rejects.toThrow("NEXT_REDIRECT");
    }
    gci.mockResolvedValue("issue-ip-last");
    expect(
      await requestCode(undefined, formData({ email: "issue@x.com" })),
    ).toEqual({
      error: TOO_MANY_REQUESTS,
    });
    expect(rpr).toHaveBeenCalledTimes(limit);
  });

  test("resendCode: 한도 초과 시 새 코드 발급 없이 검증 화면 유지", async () => {
    getCk.mockResolvedValue({
      email: "resend@x.com",
      expiresAt: "",
      verified: false,
    });
    rpr.mockResolvedValue({ expiresAt: EXPIRES });
    const { limit } = ACTION_LIMITS.resetIssue;
    for (let i = 0; i < limit + 3; i++)
      await expect(resendCode()).rejects.toThrow("NEXT_REDIRECT");
    expect(rpr).toHaveBeenCalledTimes(limit);
    expect(rd).toHaveBeenLastCalledWith("/forgot-password/verify");
  });
});

describe("verifyCode (2단계)", () => {
  test("레이트리밋: 같은 이메일 코드 검증은 IP를 바꿔도 한도 초과 시 검증 미호출", async () => {
    getCk.mockResolvedValue({
      email: "brute@x.com",
      expiresAt: "",
      verified: false,
    });
    vrc.mockResolvedValue({ ok: false, error: "코드가 일치하지 않습니다." });
    const { limit } = ACTION_LIMITS.resetVerifyEmail;
    for (let i = 0; i < limit; i++) {
      gci.mockResolvedValue(`brute-ip-${i}`);
      await verifyCode(undefined, formData({ code: "123456" }));
    }
    gci.mockResolvedValue("brute-ip-last");
    expect(await verifyCode(undefined, formData({ code: "123456" }))).toEqual({
      error: TOO_MANY_REQUESTS,
    });
    expect(vrc).toHaveBeenCalledTimes(limit);
  });

  test("레이트리밋: 한 IP가 여러 이메일 코드를 두드리면 차단", async () => {
    gci.mockResolvedValue("brute-one-ip");
    vrc.mockResolvedValue({ ok: false, error: "코드가 일치하지 않습니다." });
    const { limit } = ACTION_LIMITS.resetVerifyIp;
    for (let i = 0; i < limit; i++) {
      getCk.mockResolvedValue({
        email: `victim${i}@x.com`,
        expiresAt: "",
        verified: false,
      });
      await verifyCode(undefined, formData({ code: "123456" }));
    }
    getCk.mockResolvedValue({
      email: "victim-last@x.com",
      expiresAt: "",
      verified: false,
    });
    expect(await verifyCode(undefined, formData({ code: "123456" }))).toEqual({
      error: TOO_MANY_REQUESTS,
    });
    expect(vrc).toHaveBeenCalledTimes(limit);
  });

  test("쿠키 없음 → redirect(forgot-password)", async () => {
    getCk.mockResolvedValue(undefined);
    await expect(
      verifyCode(undefined, formData({ code: "123456" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(rd).toHaveBeenCalledWith("/forgot-password");
  });

  test("코드 형식 오류 → error", async () => {
    getCk.mockResolvedValue({
      email: "a@x.com",
      expiresAt: "",
      verified: false,
    });
    expect(await verifyCode(undefined, formData({ code: "12" }))).toEqual({
      error: "6자리 숫자 코드를 입력하세요.",
    });
  });

  test("코드 불일치 → error(verifyResetCode 결과)", async () => {
    getCk.mockResolvedValue({
      email: "a@x.com",
      expiresAt: "",
      verified: false,
    });
    vrc.mockResolvedValue({ ok: false, error: "코드가 일치하지 않습니다." });
    expect(await verifyCode(undefined, formData({ code: "123456" }))).toEqual({
      error: "코드가 일치하지 않습니다.",
    });
  });

  test("성공 → setResetCookie(verified:true) + redirect(reset)", async () => {
    getCk.mockResolvedValue({
      email: "a@x.com",
      expiresAt: "",
      verified: false,
    });
    vrc.mockResolvedValue({ ok: true });
    await expect(
      verifyCode(undefined, formData({ code: "123456" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(setCk).toHaveBeenCalledWith(
      expect.objectContaining({ email: "a@x.com", verified: true }),
    );
    expect(rd).toHaveBeenCalledWith("/forgot-password/reset");
  });
});

describe("submitNewPassword (3단계)", () => {
  test("미인증 쿠키 → redirect(forgot-password)", async () => {
    getCk.mockResolvedValue({
      email: "a@x.com",
      expiresAt: "",
      verified: false,
    });
    await expect(
      submitNewPassword(
        undefined,
        formData({ password: "Abcdef1!", confirm: "Abcdef1!" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(rd).toHaveBeenCalledWith("/forgot-password");
  });

  test("비밀번호 불일치 → zod 필드 에러", async () => {
    getCk.mockResolvedValue({
      email: "a@x.com",
      expiresAt: "",
      verified: true,
    });
    const r = await submitNewPassword(
      undefined,
      formData({ password: "Abcdef1!", confirm: "Different1!" }),
    );
    expect(r?.errors?.confirm?.length).toBeGreaterThan(0);
    expect(rp).not.toHaveBeenCalled();
  });

  test("성공 → clearResetCookie + redirect(signin?reset=1)", async () => {
    getCk.mockResolvedValue({
      email: "a@x.com",
      expiresAt: "",
      verified: true,
    });
    rp.mockResolvedValue({ ok: true });
    await expect(
      submitNewPassword(
        undefined,
        formData({ password: "Abcdef1!", confirm: "Abcdef1!" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(clearCk).toHaveBeenCalled();
    expect(rd).toHaveBeenCalledWith("/signin?reset=1");
  });
});
