import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const { toggleCommentReactionAction } = vi.hoisted(() => ({
  toggleCommentReactionAction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./comment-actions", () => ({ toggleCommentReactionAction }));

import CommentReactions from "./comment-reactions";

const props = {
  commentId: "c1",
  feedId: "f1",
  slug: "s1",
  canParticipate: true,
};

// jsdom은 dialog.showModal 미구현 → 스텁(비참여자 로그인 모달 경로).
beforeEach(() => {
  toggleCommentReactionAction.mockClear();
  vi.useRealTimers();
  HTMLDialogElement.prototype.showModal = vi.fn();
});

describe("CommentReactions", () => {
  test("기존 리액션 칩 렌더(aria-pressed·aria-label·카운트)", () => {
    render(
      <CommentReactions
        {...props}
        initialReactions={[{ emoji: "👍", count: 3, reacted: true }]}
      />,
    );
    const chip = screen.getByRole("button", { name: "최고 반응 3개" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(chip).toHaveTextContent("3");
  });

  test("피커 토글: aria-expanded + 메뉴 5종", () => {
    render(<CommentReactions {...props} initialReactions={[]} />);
    const trigger = screen.getByRole("button", { name: "이모지 반응 추가" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu", { name: "이모지 선택" })).toBeTruthy();
    expect(screen.getAllByRole("menuitemcheckbox")).toHaveLength(5);
  });

  test("낙관 토글 + 디바운스 후 액션 1회 호출", () => {
    vi.useFakeTimers();
    render(
      <CommentReactions
        {...props}
        initialReactions={[{ emoji: "👍", count: 2, reacted: false }]}
      />,
    );
    const chip = screen.getByRole("button", { name: "최고 반응 2개" });
    fireEvent.click(chip); // 낙관: 2→3, pressed
    expect(
      screen.getByRole("button", { name: "최고 반응 3개" }),
    ).toHaveAttribute("aria-pressed", "true");
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(toggleCommentReactionAction).toHaveBeenCalledTimes(1);
    expect(toggleCommentReactionAction).toHaveBeenCalledWith(
      "c1",
      "f1",
      "s1",
      "👍",
    );
    vi.useRealTimers();
  });

  test("비참여자: 클릭 시 액션 미호출(로그인 모달)", () => {
    render(
      <CommentReactions
        {...props}
        canParticipate={false}
        initialReactions={[{ emoji: "👍", count: 1, reacted: false }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "최고 반응 1개" }));
    expect(toggleCommentReactionAction).not.toHaveBeenCalled();
  });

  test("액션 실패(429 등) 시 낙관 토글 롤백", async () => {
    vi.useFakeTimers();
    toggleCommentReactionAction.mockRejectedValueOnce(new Error("429"));
    render(
      <CommentReactions
        {...props}
        initialReactions={[{ emoji: "👍", count: 2, reacted: false }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "최고 반응 2개" }));
    // 낙관 적용: 2→3, pressed
    expect(
      screen.getByRole("button", { name: "최고 반응 3개" }),
    ).toHaveAttribute("aria-pressed", "true");
    // 디바운스 발화 → 액션 reject → catch 롤백(마이크로태스크 flush).
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    const reverted = screen.getByRole("button", { name: "최고 반응 2개" });
    expect(reverted).toHaveAttribute("aria-pressed", "false");
    vi.useRealTimers();
  });
});
