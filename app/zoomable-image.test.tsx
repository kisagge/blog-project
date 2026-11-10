import { beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ZoomableImage from "@/app/zoomable-image";

// jsdom은 dialog.showModal/close 미구현 → open 속성·close 이벤트로 흉내.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });
});

describe("ZoomableImage", () => {
  test("트리거 버튼: alt 기반 이름 + dialog 팝업 안내, 본문 이미지는 치수·lazy 유지", () => {
    render(
      <ZoomableImage src="/a.png" alt="고양이" width={800} height={600} />,
    );
    const btn = screen.getByRole("button", {
      name: "이미지 크게 보기: 고양이",
    });
    expect(btn).toHaveAttribute("aria-haspopup", "dialog");
    const img = btn.querySelector("img")!;
    expect(img).toHaveAttribute("width", "800");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(document.querySelector("dialog")).toBeNull(); // 열기 전엔 미렌더
  });

  test("클릭 → body에 포털된 모달로 큰 이미지 표시, 닫기 버튼으로 닫힘", () => {
    const { container } = render(<ZoomableImage src="/a.png" alt="고양이" />);
    fireEvent.click(screen.getByRole("button", { name: /크게 보기/ }));
    const dialog = screen.getByRole("dialog", { name: "고양이" });
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    expect(container.contains(dialog)).toBe(false); // p 안에 dialog가 들어가지 않게 포털
    expect(dialog.querySelector('img[src="/a.png"]')).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(document.querySelector("dialog")).toBeNull();
  });

  test("백드롭(다이얼로그 자신) 클릭은 닫고, 안쪽 이미지 클릭은 유지", () => {
    render(<ZoomableImage src="/a.png" alt="" />);
    fireEvent.click(screen.getByRole("button", { name: "이미지 크게 보기" }));
    const dialog = screen.getByRole("dialog", { name: "확대 이미지" });
    fireEvent.click(dialog.querySelector("img")!);
    expect(document.querySelector("dialog")).not.toBeNull();
    fireEvent.click(dialog);
    expect(document.querySelector("dialog")).toBeNull();
  });
});
