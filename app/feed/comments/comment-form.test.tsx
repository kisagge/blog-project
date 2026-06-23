import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";

const { addCommentAction } = vi.hoisted(() => ({ addCommentAction: vi.fn() }));
vi.mock("./comment-actions", () => ({ addCommentAction }));

import CommentForm from "./comment-form";

const KEY = "byjang-draft:member:comment:f1";

beforeEach(() => {
  localStorage.clear();
  addCommentAction.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("CommentForm 자동저장/복원", () => {
  test("입력 → 디바운스 후 초안 저장(최상위 박스)", () => {
    vi.useFakeTimers();
    render(<CommentForm feedId="f1" slug="s" canParticipate />);
    fireEvent.change(screen.getByPlaceholderText("댓글을 입력하세요"), {
      target: { value: "잃어버리면 안 되는 긴 댓글" },
    });
    act(() => vi.advanceTimersByTime(600));
    expect(localStorage.getItem(KEY)).toContain("잃어버리면 안 되는 긴 댓글");
  });

  test("마운트 시 저장된 초안 복원", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ savedAt: Date.now(), data: "복원될 내용" }),
    );
    render(<CommentForm feedId="f1" slug="s" canParticipate />);
    expect(
      (screen.getByPlaceholderText("댓글을 입력하세요") as HTMLTextAreaElement)
        .value,
    ).toBe("복원될 내용");
  });

  test("답글 폼(parentId)은 자동저장 안 함", () => {
    vi.useFakeTimers();
    render(<CommentForm feedId="f1" slug="s" parentId="c1" canParticipate />);
    fireEvent.change(screen.getByPlaceholderText("댓글을 입력하세요"), {
      target: { value: "답글 내용" },
    });
    act(() => vi.advanceTimersByTime(600));
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  test("제출 성공 시 초안 삭제", async () => {
    addCommentAction.mockResolvedValue({ comment: { id: "x" } });
    localStorage.setItem(
      KEY,
      JSON.stringify({ savedAt: Date.now(), data: "제출될 내용" }),
    );
    render(<CommentForm feedId="f1" slug="s" canParticipate />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "댓글 등록" }));
    });
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
