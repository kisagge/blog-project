import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/app/feed/(list)/actions", () => ({ loadFeeds: vi.fn() }));

import FeedList from "@/app/feed/(list)/feed-list";
import { loadFeeds } from "@/app/feed/(list)/actions";
import type { FeedCard } from "@/app/feed/(list)/feed-card";

const card = (slug: string): FeedCard => ({
  slug,
  title: `제목 ${slug}`,
  summary: null,
  snippet: null,
  date: "2026-11-20T00:00:00.000Z",
  viewCount: 0,
  visibility: "public",
  authorName: null,
  authorId: null,
  tags: [],
});

// IntersectionObserver 대역: 센티넬 노출을 직접 일으킨다.
let reveal: () => void = () => {};
beforeEach(() => {
  vi.mocked(loadFeeds).mockReset();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
        reveal = () => cb([{ isIntersecting: true }]);
      }
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

const titles = () => screen.getAllByRole("heading").map((h) => h.textContent);

describe("FeedList 무한 스크롤", () => {
  test("다음 페이지 요청이 실패해도 '불러오는 중'에 멈추지 않고, 다시 시도로 이어서 불러옴", async () => {
    vi.mocked(loadFeeds)
      .mockRejectedValueOnce(new Error("429"))
      .mockResolvedValueOnce({ items: [card("b")], hasMore: false });
    render(
      <FeedList initialItems={[card("a")]} initialHasMore initialQuery="" />,
    );
    await act(async () => reveal());
    expect(screen.getByRole("alert")).toHaveTextContent("불러오지 못했습니다");
    expect(screen.queryByText("불러오는 중…")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    });
    expect(titles()).toEqual(["제목 a", "제목 b"]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("페이지 사이에 새 글이 올라와 밀린 항목은 중복 표시하지 않음", async () => {
    vi.mocked(loadFeeds).mockResolvedValueOnce({
      items: [card("b"), card("c")],
      hasMore: false,
    });
    render(
      <FeedList
        initialItems={[card("a"), card("b")]}
        initialHasMore
        initialQuery=""
      />,
    );
    await act(async () => reveal());
    expect(titles()).toEqual(["제목 a", "제목 b", "제목 c"]);
  });
});

describe("FeedList 정렬 토글", () => {
  test("토글 버튼은 aria-pressed로 선택 상태", () => {
    render(
      <FeedList
        initialItems={[card("a")]}
        initialHasMore={false}
        initialQuery=""
        author="member"
        showSort
      />,
    );
    expect(screen.getByRole("button", { name: "최신순" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "인기순" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
