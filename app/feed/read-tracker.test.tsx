import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import ReadTracker from "@/app/feed/read-tracker";

const sendBeacon = vi.fn(() => true);
let visibility: DocumentVisibilityState = "visible";

function mountArticle(top: number, height: number) {
  const main = document.createElement("main");
  const article = document.createElement("article");
  article.getBoundingClientRect = () => ({ top, height }) as unknown as DOMRect;
  main.appendChild(article);
  document.body.appendChild(main);
  return article;
}
function setVisibility(v: DocumentVisibilityState) {
  visibility = v;
  fireEvent(document, new Event("visibilitychange"));
}
const lastBody = () =>
  JSON.parse(sendBeacon.mock.calls.at(-1)![1 as never] as unknown as string);

beforeEach(() => {
  vi.useFakeTimers();
  sendBeacon.mockClear();
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: sendBeacon,
  });
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
  visibility = "visible";
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: 800,
  });
});
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("ReadTracker", () => {
  test("탭이 가려질 때 깊이·활성 시간을 /api/read로 비콘 전송", () => {
    mountArticle(0, 2000); // 첫 화면에서 40%
    render(<ReadTracker feedId="f1" />);
    act(() => vi.advanceTimersByTime(15_000)); // 활성 15초
    setVisibility("hidden");
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.calls[0][0 as never]).toBe("/api/read");
    expect(lastBody()).toEqual({ feedId: "f1", depth: 40, seconds: 15 });
  });

  test("30초 이상 상호작용이 없으면 시간 적립 중단, 활동하면 재개", () => {
    mountArticle(0, 2000);
    render(<ReadTracker feedId="f1" />);
    act(() => vi.advanceTimersByTime(60_000)); // 30초까지만 적립(그 뒤 자리 비움)
    fireEvent.keyDown(window);
    act(() => vi.advanceTimersByTime(10_000));
    setVisibility("hidden");
    // 5~25초 틱 5회(25초) + 활동 재개 후 10초 = 35초(30초 도달 시 주기 전송 + 숨김 시 나머지)
    const total = sendBeacon.mock.calls.reduce(
      (n, c) => n + JSON.parse(c[1 as never] as unknown as string).seconds,
      0,
    );
    expect(total).toBe(35);
  });

  test("새로 보낼 게 없으면 다시 보내지 않고, 언마운트 시 남은 값 전송", () => {
    mountArticle(0, 2000);
    const { unmount } = render(<ReadTracker feedId="f1" />);
    act(() => vi.advanceTimersByTime(5_000));
    setVisibility("hidden");
    setVisibility("visible");
    setVisibility("hidden"); // 변화 없음 → 미전송
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(5_000)); // 가려진 동안은 적립 안 됨
    setVisibility("visible");
    act(() => vi.advanceTimersByTime(5_000));
    unmount();
    expect(sendBeacon).toHaveBeenCalledTimes(2);
    expect(lastBody().seconds).toBe(5);
  });

  test("활성 시간이 30초 쌓이면 페이지를 떠나지 않아도 주기 전송", () => {
    mountArticle(0, 2000);
    render(<ReadTracker feedId="f1" />);
    for (let i = 0; i < 6; i++) {
      fireEvent.scroll(window); // 계속 읽는 중(자리 비움 아님)
      act(() => vi.advanceTimersByTime(5_000));
    }
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(lastBody().seconds).toBe(30);
  });

  test("본문(article)이 없으면 아무것도 하지 않음", () => {
    const { unmount } = render(<ReadTracker feedId="f1" />);
    act(() => vi.advanceTimersByTime(20_000));
    setVisibility("hidden");
    unmount();
    expect(sendBeacon).not.toHaveBeenCalled();
  });
});
