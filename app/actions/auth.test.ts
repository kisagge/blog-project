import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/session", () => ({
  createAdminSession: vi.fn(),
  deleteSession: vi.fn(),
}));
vi.mock("@/lib/client-ip", () => ({
  getClientIp: vi.fn(async () => "1.2.3.4"),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

import { login } from "@/app/actions/auth";
import { createAdminSession } from "@/lib/session";
import { getClientIp } from "@/lib/client-ip";
import { ACTION_LIMITS, TOO_MANY_REQUESTS } from "@/lib/rate-limit";
import { formData } from "@/test/helpers";

const cas = vi.mocked(createAdminSession);
const gci = vi.mocked(getClientIp);

beforeEach(() => {
  vi.stubEnv("ADMIN_PASSWORD", "correct-horse");
  vi.stubEnv("ADMIN_TOTP_SECRET", "");
  cas.mockClear();
});

describe("관리자 login", () => {
  test("올바른 비밀번호 → 세션 생성 후 /admin", async () => {
    gci.mockResolvedValue("admin-ok");
    await expect(
      login(undefined, formData({ password: "correct-horse" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(cas).toHaveBeenCalledTimes(1);
  });

  test("틀린 비밀번호 → 에러, 세션 없음", async () => {
    gci.mockResolvedValue("admin-wrong");
    expect(await login(undefined, formData({ password: "nope" }))).toEqual({
      error: "비밀번호가 올바르지 않습니다.",
    });
    expect(cas).not.toHaveBeenCalled();
  });

  test("ADMIN_PASSWORD 미설정이면 빈 비밀번호로도 로그인 불가", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    gci.mockResolvedValue("admin-empty");
    expect(await login(undefined, formData({ password: "" }))).toEqual({
      error: "비밀번호가 올바르지 않습니다.",
    });
    expect(cas).not.toHaveBeenCalled();
  });

  test("레이트리밋: IP당 한도 초과 시 정답이어도 차단", async () => {
    gci.mockResolvedValue("admin-brute");
    const { limit } = ACTION_LIMITS.adminLogin;
    for (let i = 0; i < limit; i++)
      await login(undefined, formData({ password: `guess-${i}` }));
    expect(
      await login(undefined, formData({ password: "correct-horse" })),
    ).toEqual({
      error: TOO_MANY_REQUESTS,
    });
    expect(cas).not.toHaveBeenCalled();
  });
});
