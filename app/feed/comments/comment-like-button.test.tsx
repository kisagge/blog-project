import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const { toggleCommentLikeAction } = vi.hoisted(() => ({
  toggleCommentLikeAction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./comment-actions", () => ({ toggleCommentLikeAction }));

import CommentLikeButton from "./comment-like-button";

const props = {
  commentId: "c1",
  feedId: "f1",
  slug: "s1",
};

// jsdom은 dialog.showModal 미구현 → 스텁(비참여자 로그인 모달 경로).
beforeEach(() => {
  toggleCommentLikeAction.mockClear();
  vi.useRealTimers();
  HTMLDialogElement.prototype.showModal = vi.fn();
});

describe("CommentLikeButton", () => {
  test("낙관 토글 + 디바운스 후 액션 1회 호출", () => {
    vi.useFakeTimers();
    render(
      <CommentLikeButton
        {...props}
        initialCount={2}
        initialLiked={false}
        canParticipate
      />,
    );
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "true");
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(toggleCommentLikeAction).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  test("액션 실패(429 등) 시 낙관 토글 롤백", async () => {
    vi.useFakeTimers();
    toggleCommentLikeAction.mockRejectedValueOnce(new Error("429"));
    render(
      <CommentLikeButton
        {...props}
        initialCount={2}
        initialLiked={false}
        canParticipate
      />,
    );
    const btn = screen.getByRole("button");
    fireEvent.click(btn); // 낙관: 2→3, pressed
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn).toHaveTextContent("3");
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn).not.toHaveTextContent("3"); // count 2로 복귀(2는 표기되나 3은 아님)
    vi.useRealTimers();
  });

  test("비참여자: 클릭 시 액션 미호출(로그인 모달)", () => {
    render(
      <CommentLikeButton
        {...props}
        initialCount={1}
        initialLiked={false}
        canParticipate={false}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(toggleCommentLikeAction).not.toHaveBeenCalled();
  });
});
