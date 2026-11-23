import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: vi.fn() }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: vi.fn() }));
vi.mock("@/lib/rate-limit", async (orig) => ({
  ...(await orig<typeof import("@/lib/rate-limit")>()),
  allowAction: vi.fn(),
}));

import { verifyTurnstile } from "@/lib/turnstile";
import { getClientIp } from "@/lib/client-ip";
import { allowAction, TOO_MANY_REQUESTS } from "@/lib/rate-limit";
import { CAPTCHA_FAILED, clientIpKey, guardPublicForm } from "@/lib/form-guard";
import { formData } from "@/test/helpers";

const vt = vi.mocked(verifyTurnstile);
const gci = vi.mocked(getClientIp);
const aa = vi.mocked(allowAction);

beforeEach(() => {
  vi.clearAllMocks();
  gci.mockResolvedValue("1.2.3.4");
  aa.mockReturnValue(true);
  vt.mockResolvedValue(true);
});

describe("clientIpKey", () => {
  test("IP가 없으면 한 버킷(unknown)", async () => {
    gci.mockResolvedValue(undefined);
    expect(await clientIpKey()).toBe("unknown");
  });
});

describe("guardPublicForm", () => {
  test("통과하면 null, 한도는 IP 키·CAPTCHA는 폼 토큰+IP로 검사", async () => {
    const fd = formData({ "cf-turnstile-response": "tok" });
    expect(await guardPublicForm("signup", fd)).toBeNull();
    expect(aa).toHaveBeenCalledWith("signup", "1.2.3.4");
    expect(vt).toHaveBeenCalledWith("tok", "1.2.3.4");
  });

  test("요청 한도 초과면 CAPTCHA 검증 전에 차단", async () => {
    aa.mockReturnValue(false);
    expect(await guardPublicForm("signin", formData({}))).toBe(
      TOO_MANY_REQUESTS,
    );
    expect(vt).not.toHaveBeenCalled();
  });

  test("CAPTCHA 실패 문구(토큰 없으면 빈 문자열로 검증)", async () => {
    vt.mockResolvedValue(false);
    expect(await guardPublicForm("passwordReset", formData({}))).toBe(
      CAPTCHA_FAILED,
    );
    expect(vt).toHaveBeenCalledWith("", "1.2.3.4");
  });
});
