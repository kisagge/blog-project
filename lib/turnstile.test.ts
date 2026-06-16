import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Mod = typeof import("@/lib/turnstile");
let m: Mod;

beforeAll(async () => {
  m = await import("@/lib/turnstile");
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TURNSTILE_SECRET_KEY;
});

function stubFetch(body: unknown, ok = true) {
  const f = vi.fn().mockResolvedValue({ ok, json: async () => body });
  vi.stubGlobal("fetch", f);
  return f;
}

describe("verifyTurnstile", () => {
  test("시크릿 미설정이면 fetch 없이 통과(비활성)", async () => {
    const f = stubFetch({ success: false });
    expect(await m.verifyTurnstile("anything")).toBe(true);
    expect(f).not.toHaveBeenCalled();
  });

  test("설정 + 성공 응답이면 true, body에 secret·response 포함", async () => {
    process.env.TURNSTILE_SECRET_KEY = "sec";
    const f = stubFetch({ success: true });
    expect(await m.verifyTurnstile("tok", "1.2.3.4")).toBe(true);
    const body = f.mock.calls[0][1].body as URLSearchParams;
    expect(body.get("secret")).toBe("sec");
    expect(body.get("response")).toBe("tok");
    expect(body.get("remoteip")).toBe("1.2.3.4");
  });

  test("설정 + 실패 응답이면 false", async () => {
    process.env.TURNSTILE_SECRET_KEY = "sec";
    stubFetch({ success: false });
    expect(await m.verifyTurnstile("tok")).toBe(false);
  });

  test("설정 시 빈 토큰은 fetch 없이 false", async () => {
    process.env.TURNSTILE_SECRET_KEY = "sec";
    const f = stubFetch({ success: true });
    expect(await m.verifyTurnstile("")).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  test("fetch 예외는 false(fail-closed)", async () => {
    process.env.TURNSTILE_SECRET_KEY = "sec";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network")),
    );
    expect(await m.verifyTurnstile("tok")).toBe(false);
  });
});

describe("turnstileSiteKey", () => {
  test("미설정이면 undefined", () => {
    delete process.env.TURNSTILE_SITE_KEY;
    expect(m.turnstileSiteKey()).toBeUndefined();
  });
  test("설정되면 값 반환", () => {
    process.env.TURNSTILE_SITE_KEY = "site123";
    expect(m.turnstileSiteKey()).toBe("site123");
    delete process.env.TURNSTILE_SITE_KEY;
  });
});
