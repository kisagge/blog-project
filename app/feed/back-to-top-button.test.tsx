import { render, screen, fireEvent, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import BackToTopButton from "@/app/feed/back-to-top-button";

function setScrollY(y: number) {
  Object.defineProperty(window, "scrollY", {
    value: y,
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  setScrollY(0);
  // jsdom엔 matchMedia가 없어 스텁(reduced-motion=false).
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
  window.scrollTo = vi.fn() as never;
});
afterEach(() => setScrollY(0));

describe("BackToTopButton", () => {
  test("스크롤 0이면 버튼 숨김", () => {
    render(<BackToTopButton />);
    expect(screen.queryByRole("button", { name: "맨 위로" })).toBeNull();
  });

  test("임계 초과 스크롤 시 등장 → 클릭 시 최상단으로", () => {
    render(<BackToTopButton />);
    setScrollY(800);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    const btn = screen.getByRole("button", { name: "맨 위로" });
    fireEvent.click(btn);
    expect(window.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ top: 0 }),
    );
  });
});
