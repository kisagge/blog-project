import { describe, expect, test } from "vitest";
import { pageWindow, sliceHasMore } from "@/lib/pagination";

describe("pageWindow", () => {
  test("1페이지부터 skip 계산, 1 미만은 1페이지", () => {
    expect(pageWindow(1, 20)).toEqual({ skip: 0, take: 20 });
    expect(pageWindow(3, 20)).toEqual({ skip: 40, take: 20 });
    expect(pageWindow(0, 20)).toEqual({ skip: 0, take: 20 });
    expect(pageWindow(-5, 30)).toEqual({ skip: 0, take: 30 });
  });
});

describe("sliceHasMore", () => {
  test("take+1개면 다음 있음 + take개로 자름", () => {
    expect(sliceHasMore([1, 2, 3], 2)).toEqual({
      items: [1, 2],
      hasMore: true,
    });
  });
  test("take개 이하면 다음 없음, 그대로", () => {
    expect(sliceHasMore([1, 2], 2)).toEqual({ items: [1, 2], hasMore: false });
    expect(sliceHasMore([], 2)).toEqual({ items: [], hasMore: false });
  });
});
