import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createTtlCache } from "@/lib/ttl-cache";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createTtlCache", () => {
  test("TTL 안에서는 다시 계산하지 않고, 지나면 다시 계산", async () => {
    const c = createTtlCache<string>({ ttlMs: 1000, max: 10 });
    const compute = vi.fn(async () => "v");
    expect(await c.getOrSet("k", compute)).toBe("v");
    expect(await c.getOrSet("k", compute)).toBe("v");
    expect(compute).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1001);
    await c.getOrSet("k", compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  test("동시에 같은 키를 요청해도 한 번만 계산(진행 중 Promise 공유)", async () => {
    const c = createTtlCache<number>({ ttlMs: 1000, max: 10 });
    let n = 0;
    const compute = () =>
      new Promise<number>((r) => setTimeout(() => r(++n), 10));
    const both = Promise.all([
      c.getOrSet("k", compute),
      c.getOrSet("k", compute),
    ]);
    vi.advanceTimersByTime(10);
    expect(await both).toEqual([1, 1]);
  });

  test("계산이 실패하면 저장하지 않음(다음 요청에서 재시도)", async () => {
    const c = createTtlCache<string>({ ttlMs: 1000, max: 10 });
    await expect(
      c.getOrSet("k", async () => Promise.reject(new Error("x"))),
    ).rejects.toThrow("x");
    expect(await c.getOrSet("k", async () => "ok")).toBe("ok");
  });

  test("max를 넘으면 가장 오래 안 쓴 항목부터 버림, clear는 전부 비움", async () => {
    const c = createTtlCache<string>({ ttlMs: 10_000, max: 2 });
    const compute = vi.fn(async (k: string) => k);
    await c.getOrSet("a", () => compute("a"));
    await c.getOrSet("b", () => compute("b"));
    await c.getOrSet("a", () => compute("a")); // a 사용 → b가 가장 오래됨
    await c.getOrSet("c", () => compute("c")); // b 축출
    await c.getOrSet("a", () => compute("a"));
    await c.getOrSet("b", () => compute("b"));
    expect(compute.mock.calls.map((x) => x[0])).toEqual(["a", "b", "c", "b"]);
    c.clear();
    await c.getOrSet("a", () => compute("a"));
    expect(compute).toHaveBeenCalledTimes(5);
  });
});
