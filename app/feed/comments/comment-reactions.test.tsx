import { describe, expect, test, vi, beforeEach } from "vitest";
import { screen, fireEvent, act } from "@testing-library/react";
import { renderFeed } from "@/test/render-feed";

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
    renderFeed(
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
    renderFeed(<CommentReactions {...props} initialReactions={[]} />);
    const trigger = screen.getByRole("button", { name: "이모지 반응 추가" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu", { name: "이모지 선택" })).toBeTruthy();
    expect(screen.getAllByRole("menuitemcheckbox")).toHaveLength(5);
  });

  test("낙관 토글 + 디바운스 후 액션 1회 호출", () => {
    vi.useFakeTimers();
    renderFeed(
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
    renderFeed(
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
    renderFeed(
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

describe("CommentReactions 피커 키보드(ARIA menu)", () => {
  test("방향키·Home/End로 항목 이동(순환)", () => {
    renderFeed(<CommentReactions {...props} initialReactions={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "이모지 반응 추가" }));
    const items = screen.getAllByRole("menuitemcheckbox");
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(items[1], { key: "End" });
    expect(document.activeElement).toBe(items[items.length - 1]);
    fireEvent.keyDown(items[items.length - 1], { key: "ArrowRight" });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(items[items.length - 1]);
    fireEvent.keyDown(items[items.length - 1], { key: "Home" });
    expect(document.activeElement).toBe(items[0]);
  });
});
