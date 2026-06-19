import { describe, expect, test } from "vitest";
import { rateLimit, allowAction, ACTION_LIMITS } from "@/lib/rate-limit";

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

describe("allowAction", () => {
  test("scope 한도까지 허용, 초과 차단", () => {
    const id = `u-${Math.random()}`;
    const { limit } = ACTION_LIMITS.report;
    for (let i = 0; i < limit; i++)
      expect(allowAction("report", id)).toBe(true);
    expect(allowAction("report", id)).toBe(false);
  });

  test("scope/id가 다르면 독립 버킷", () => {
    const id = `x-${Math.random()}`;
    expect(allowAction("signin", id)).toBe(true);
    expect(allowAction("signup", id)).toBe(true); // 다른 scope → 독립
    expect(allowAction("signin", `${id}-other`)).toBe(true); // 다른 id → 독립
  });
});
