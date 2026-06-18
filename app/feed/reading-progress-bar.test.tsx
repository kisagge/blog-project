import { render } from "@testing-library/react";
import ReadingProgressBar from "@/app/feed/reading-progress-bar";

describe("ReadingProgressBar", () => {
  test("진행바를 aria-hidden 장식으로 렌더(스크롤 0%)", () => {
    const { container } = render(<ReadingProgressBar />);
    const bar = container.firstChild as HTMLElement;
    expect(bar).toBeTruthy();
    expect(bar.getAttribute("aria-hidden")).toBe("true");
    // jsdom은 실제 스크롤 측정이 없어 0% — 폭은 수동/E2E 확인.
    expect(bar.style.width).toBe("0%");
  });

  test("언마운트 시 스크롤 리스너 정리(누수 없음)", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<ReadingProgressBar />);
    unmount();
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
    remove.mockRestore();
  });
});
