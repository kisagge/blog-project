import { beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LoginPromptProvider, useLoginPrompt } from "@/app/feed/login-prompt";

function Opener({ label }: { label: string }) {
  const prompt = useLoginPrompt();
  return (
    <button type="button" onClick={prompt}>
      {label}
    </button>
  );
}

// jsdom은 dialog.showModal/close 미구현 → open 속성으로 흉내.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
});

describe("LoginPromptProvider", () => {
  test("참여 버튼이 여러 개여도 안내 대화상자는 하나, 이름·닫기 버튼 있음", () => {
    render(
      <LoginPromptProvider>
        <Opener label="좋아요" />
        <Opener label="댓글 좋아요" />
        <Opener label="리액션" />
      </LoginPromptProvider>,
    );
    expect(document.querySelectorAll("dialog")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "리액션" }));
    const dialog = screen.getByRole("dialog", { name: "로그인이 필요합니다" });
    expect(dialog).toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(dialog).not.toHaveAttribute("open");
  });

  test("Provider 없이 쓰면 바로 알 수 있게 오류", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Opener label="x" />)).toThrow(/LoginPromptProvider/);
  });
});
