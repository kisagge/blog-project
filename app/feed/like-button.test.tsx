import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

// server-only 모듈을 끌어오지 않도록 액션을 모킹(클라 단위 테스트).
const getLikeSummaryAction = vi.fn(async () => ({ count: 5, liked: false }));
const toggleLikeAction = vi.fn(async () => {});
vi.mock("@/app/feed/comments/comment-actions", () => ({
  getLikeSummaryAction: () => getLikeSummaryAction(),
  toggleLikeAction: () => toggleLikeAction(),
}));

import { FeedEventsProvider } from "@/app/feed/feed-events-context";
import LikeButton from "@/app/feed/like-button";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  closed = false;
  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
  }
}

function renderButton() {
  return render(
    <FeedEventsProvider feedId="f1">
      <LikeButton
        feedId="f1"
        slug="s"
        initialCount={0}
        initialLiked={false}
        canParticipate
      />
    </FeedEventsProvider>,
  );
}

describe("LikeButton 재접속 재동기화 vs 디바운스", () => {
  const orig = globalThis.EventSource;
  beforeEach(() => {
    FakeEventSource.instances = [];
    getLikeSummaryAction.mockClear();
    toggleLikeAction.mockClear();
    vi.useFakeTimers();
    // @ts-expect-error 테스트용 주입
    globalThis.EventSource = FakeEventSource;
  });
  afterEach(() => {
    vi.useRealTimers();
    globalThis.EventSource = orig;
  });

  test("디바운스 토글 대기 중 resync는 하트를 덮지 않는다(서버 재조회 생략)", () => {
    renderButton();
    const btn = screen.getByRole("button", { name: /좋아요/ });
    fireEvent.click(btn); // 낙관적 좋아요 → liked=true, 디바운스 타이머 대기
    expect(btn).toHaveAttribute("aria-pressed", "true");

    const es = FakeEventSource.instances[0];
    act(() => es.onopen?.()); // 첫 연결
    act(() => es.onopen?.()); // 재접속 → resync (타이머 대기 중이라 건너뜀)

    expect(getLikeSummaryAction).not.toHaveBeenCalled();
    expect(btn).toHaveAttribute("aria-pressed", "true"); // 하트 유지
  });

  test("대기 중인 토글이 없으면 resync가 서버 truth로 카운트 재동기화", async () => {
    renderButton();
    const es = FakeEventSource.instances[0];
    act(() => es.onopen?.()); // 첫 연결
    await act(async () => {
      es.onopen?.(); // 재접속 → resync
    });
    expect(getLikeSummaryAction).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: /좋아요 5/ }),
    ).toBeInTheDocument();
  });

  test("액션 실패(429 등) 시 낙관 좋아요 롤백", async () => {
    toggleLikeAction.mockRejectedValueOnce(new Error("429"));
    renderButton();
    const btn = screen.getByRole("button", { name: /좋아요/ });
    fireEvent.click(btn); // 낙관: ♥ on, 0→1
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /좋아요 1/ })).toBeTruthy();
    // 디바운스 발화 → 액션 reject → catch 롤백.
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /좋아요 0/ })).toBeTruthy();
  });
});
