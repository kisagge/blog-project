import { describe, expect, test } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "@/lib/security-headers";

describe("contentSecurityPolicy", () => {
  test("prod: 잠금 지시어·외부 화이트리스트·upgrade 포함, unsafe-eval 미포함", () => {
    const csp = contentSecurityPolicy(false);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("https://challenges.cloudflare.com");
    expect(csp).toContain("https://t1.kakaocdn.net");
    expect(csp).toContain("https://*.kakao.com");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  test("dev: unsafe-eval 포함, upgrade-insecure-requests 미포함", () => {
    const csp = contentSecurityPolicy(true);
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});

describe("securityHeaders", () => {
  test("prod: 6개 헤더 + HSTS, 핵심 값 확인", () => {
    const headers = securityHeaders(false);
    const map = new Map(headers.map((h) => [h.key, h.value]));
    expect(map.get("X-Frame-Options")).toBe("DENY");
    expect(map.get("X-Content-Type-Options")).toBe("nosniff");
    expect(map.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(map.has("Permissions-Policy")).toBe(true);
    expect(map.has("Content-Security-Policy")).toBe(true);
    expect(map.get("Strict-Transport-Security")).toContain("max-age=");
  });

  test("dev: HSTS 미포함", () => {
    const keys = securityHeaders(true).map((h) => h.key);
    expect(keys).not.toContain("Strict-Transport-Security");
  });
});
