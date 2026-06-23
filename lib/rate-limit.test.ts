import { describe, expect, test } from "vitest";
import {
  rateLimit,
  allowAction,
  ACTION_LIMITS,
  bucketCount,
} from "@/lib/rate-limit";

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

describe("버킷 메모리 상한", () => {
  // 다른 테스트와 키/now가 겹치지 않게 큰 now 사용. 고유 키를 상한 이상 주입해도
  // 하드 캡(MAX_BUCKETS)이 버킷 수를 상한 이하로 유지(OOM 안전밸브) — 폭주/공격 가드.
  test("MAX_BUCKETS 초과 주입 시 버킷 수가 상한 이하로 유지", () => {
    const now = 9_000_000; // 모두 live(만료 스윕으로는 안 줄어듦) → 하드 캡만으로 제어됨
    for (let i = 0; i <= 50_001; i++) rateLimit(`flood-${i}`, 5, 60_000, now);
    rateLimit("flood-final", 5, 60_000, now); // 마지막 진입에서 캡 정리 트리거
    expect(bucketCount()).toBeLessThanOrEqual(50_000);
  });
});
