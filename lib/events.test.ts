import { beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Mod = typeof import("@/lib/events");
let m: Mod;

beforeAll(async () => {
  m = await import("@/lib/events");
});

describe("events bus (unread)", () => {
  test("구독자는 publish 값을 받는다", () => {
    const got: number[] = [];
    const off = m.subscribeUnread("u1", (n) => got.push(n));
    m.publishUnread("u1", 3);
    m.publishUnread("u1", 5);
    expect(got).toEqual([3, 5]);
    off();
  });

  test("다중 구독자(다중 탭) 모두 수신, 다른 유저는 격리", () => {
    const a: number[] = [];
    const b: number[] = [];
    const other: number[] = [];
    const offA = m.subscribeUnread("u2", (n) => a.push(n));
    const offB = m.subscribeUnread("u2", (n) => b.push(n));
    const offO = m.subscribeUnread("u3", (n) => other.push(n));
    m.publishUnread("u2", 1);
    expect(a).toEqual([1]);
    expect(b).toEqual([1]);
    expect(other).toEqual([]); // u3은 무관
    offA();
    offB();
    offO();
  });

  test("unsubscribe 후에는 수신하지 않는다", () => {
    const got: number[] = [];
    const off = m.subscribeUnread("u4", (n) => got.push(n));
    m.publishUnread("u4", 1);
    off();
    m.publishUnread("u4", 2);
    expect(got).toEqual([1]);
  });

  test("구독자 없는 채널 publish는 무해", () => {
    expect(() => m.publishUnread("nobody", 9)).not.toThrow();
  });
});
