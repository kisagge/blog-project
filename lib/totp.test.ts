import { describe, expect, test } from "vitest";
import { verifyTotp } from "@/lib/totp";

// RFC 6238 테스트 시크릿("12345678901234567890")의 base32.
const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("verifyTotp", () => {
  test("RFC 6238 SHA1 벡터(6자리)와 일치", () => {
    // T=59s → step 1 → 287082 (RFC 8자리 94287082의 하위 6자리)
    expect(verifyTotp(SECRET, "287082", 59_000)).toBe(true);
    // T=1111111109s → 081804
    expect(verifyTotp(SECRET, "081804", 1111111109_000)).toBe(true);
    // T=1234567890s → 005924
    expect(verifyTotp(SECRET, "005924", 1234567890_000)).toBe(true);
  });

  test("틀린 코드는 거부", () => {
    expect(verifyTotp(SECRET, "000000", 59_000)).toBe(false);
    expect(verifyTotp(SECRET, "287083", 59_000)).toBe(false);
  });

  test("형식이 잘못되면(6자리 숫자 아님) 거부", () => {
    expect(verifyTotp(SECRET, "12345", 59_000)).toBe(false);
    expect(verifyTotp(SECRET, "abcdef", 59_000)).toBe(false);
    expect(verifyTotp(SECRET, "", 59_000)).toBe(false);
  });

  test("±1 스텝(±30초) 시계 오차 허용", () => {
    // step 1 코드(287082)를 step 0/2 시각에도 허용
    expect(verifyTotp(SECRET, "287082", 29_000)).toBe(true); // step 0
    expect(verifyTotp(SECRET, "287082", 89_000)).toBe(true); // step 2
    // ±2 스텝(60초 초과)은 거부
    expect(verifyTotp(SECRET, "287082", 120_000)).toBe(false);
  });
});
