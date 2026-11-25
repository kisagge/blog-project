import { beforeEach, describe, expect, test, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { renderFeed } from "@/test/render-feed";

const { toggleBookmarkAction } = vi.hoisted(() => ({
  toggleBookmarkAction: vi.fn(),
}));
vi.mock("./bookmark-actions", () => ({ toggleBookmarkAction }));

import BookmarkButton from "./bookmark-button";

beforeEach(() => {
  toggleBookmarkAction.mockReset();
  vi.useRealTimers();
});

describe("BookmarkButton", () => {
  test("저장 요청 실패(429 등) 시 낙관 표시를 되돌림", async () => {
    vi.useFakeTimers();
    toggleBookmarkAction.mockRejectedValueOnce(new Error("429"));
    renderFeed(
      <BookmarkButton
        feedId="f1"
        slug="s1"
        initialBookmarked={false}
        canParticipate
      />,
    );
    const btn = screen.getByRole("button", { name: "저장" });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "true");
    await act(async () => vi.advanceTimersByTime(500));
    expect(toggleBookmarkAction).toHaveBeenCalledTimes(1);
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn).toHaveTextContent("저장");
    vi.useRealTimers();
  });
});
