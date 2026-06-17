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

describe("events bus (comments)", () => {
  const ev = (id: string) =>
    ({ kind: "deleted" as const, id });

  test("feed 구독자는 해당 feed 이벤트만 받는다(feed 간 격리)", () => {
    const a: string[] = [];
    const b: string[] = [];
    const offA = m.subscribeComment("feedA", (e) =>
      a.push(e.kind === "deleted" ? e.id : e.node.id),
    );
    const offB = m.subscribeComment("feedB", (e) =>
      b.push(e.kind === "deleted" ? e.id : e.node.id),
    );
    m.publishComment("feedA", ev("c1"));
    m.publishComment("feedB", ev("c2"));
    expect(a).toEqual(["c1"]);
    expect(b).toEqual(["c2"]); // feedA 이벤트는 feedB에 안 감
    offA();
    offB();
  });

  test("unsubscribe 후 미수신, unread 채널과 독립", () => {
    const got: string[] = [];
    const offC = m.subscribeComment("f", (e) =>
      got.push(e.kind === "deleted" ? e.id : "?"),
    );
    const unread: number[] = [];
    const offU = m.subscribeUnread("f", (n) => unread.push(n)); // 같은 키라도 채널 분리
    m.publishComment("f", ev("x"));
    m.publishUnread("f", 7);
    offC();
    m.publishComment("f", ev("y"));
    offU();
    expect(got).toEqual(["x"]); // offC 이후 미수신
    expect(unread).toEqual([7]); // comment publish가 unread 구독자에 안 감
  });
});
