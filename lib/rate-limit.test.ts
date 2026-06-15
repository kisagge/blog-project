import { describe, expect, test } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  test("limit까지 허용, 초과는 차단, 윈도우 지나면 리셋", () => {
    const key = `t-${Math.random()}`;
    let now = 1000;
    expect(rateLimit(key, 2, 100, now)).toBe(true);
    expect(rateLimit(key, 2, 100, now)).toBe(true);
    expect(rateLimit(key, 2, 100, now)).toBe(false); // 3번째 차단
    now += 101; // 윈도우 경과
    expect(rateLimit(key, 2, 100, now)).toBe(true);
  });

  test("키가 다르면 독립적으로 카운트", () => {
    const now = 5000;
    expect(rateLimit("a", 1, 1000, now)).toBe(true);
    expect(rateLimit("a", 1, 1000, now)).toBe(false);
    expect(rateLimit("b", 1, 1000, now)).toBe(true);
  });
});
