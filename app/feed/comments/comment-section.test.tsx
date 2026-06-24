import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { act } from "react";
import type { CommentNode } from "@/lib/comments";

// useFeedEvent의 콜백을 캡처해 테스트가 가짜 SSE 이벤트를 직접 emit한다(EventSource 불필요).
const evt = vi.hoisted(
  () => ({ cb: undefined }) as { cb?: (e: unknown) => void },
);
vi.mock("../feed-events-context", () => ({
  useFeedEvent: (cb: (e: unknown) => void) => {
    evt.cb = cb;
  },
}));
vi.mock("./comment-actions", () => ({
  deleteCommentAction: vi.fn(),
  loadMoreCommentsAction: vi.fn(),
  resyncCommentsAction: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  addCommentAction: vi.fn(),
  editCommentAction: vi.fn().mockResolvedValue({ ok: true }),
  toggleCommentLikeAction: vi.fn(),
}));
vi.mock("@/app/report/report-button", () => ({
  default: () => <button type="button">신고</button>,
}));

import CommentSection from "./comment-section";

function node(id: string, over: Partial<CommentNode> = {}): CommentNode {
  return {
    id,
    nickname: `유저-${id}`,
    userId: `u-${id}`,
    authorRole: "member",
    content: `내용 ${id}`,
    deleted: false,
    hidden: false,
    edited: false,
    createdAt: "2026-06-19T00:00:00.000Z",
    likeCount: 0,
    liked: false,
    reactions: [],
    replies: [],
    ...over,
  };
}

function renderSection(items: CommentNode[]) {
  return render(
    <CommentSection
      feedId="f1"
      slug="hello"
      sort="newest"
      canParticipate
      isAdmin={false}
      linkAuthors
      initialItems={items}
      initialTotal={items.length}
    />,
  );
}

function emit(ev: unknown) {
  act(() => evt.cb!(ev));
}

describe("CommentSection 초기 렌더", () => {
  test("총 개수와 댓글 본문 표시", () => {
    renderSection([node("a"), node("b")]);
    expect(screen.getByRole("heading", { name: "댓글 2" })).toBeInTheDocument();
    expect(screen.getByText("내용 a")).toBeInTheDocument();
    expect(screen.getByText("내용 b")).toBeInTheDocument();
  });
});

describe("CommentSection 정렬 세그먼트 토글(접근성)", () => {
  test("role=group + 활성 정렬에 aria-current, href는 ?sort= 갱신", () => {
    renderSection([node("a")]); // sort="newest"로 렌더
    const group = screen.getByRole("group", { name: "댓글 정렬" });
    expect(group).toBeInTheDocument();

    const popular = screen.getByRole("link", { name: "인기순" });
    const newest = screen.getByRole("link", { name: "최신순" });
    // 활성(최신순)만 선택 상태 노출
    expect(newest).toHaveAttribute("aria-current", "true");
    expect(popular).not.toHaveAttribute("aria-current");
    // 정렬 전환 링크는 ?sort= 쿼리만 바꾼다
    expect(popular).toHaveAttribute("href", "/feed/hello?sort=popular");
    expect(newest).toHaveAttribute("href", "/feed/hello?sort=newest");
  });
});

describe("CommentSection 실시간(SSE) 병합", () => {
  test("edited 이벤트 → 본문 갱신", () => {
    renderSection([node("a")]);
    emit({ kind: "edited", id: "a", content: "수정된 내용" });
    expect(screen.getByText("수정된 내용")).toBeInTheDocument();
    expect(screen.queryByText("내용 a")).toBeNull();
  });

  test("deleted 이벤트(답글 없는 상위) → 제거 + 총 개수 감소", () => {
    renderSection([node("a"), node("b")]);
    emit({ kind: "deleted", id: "a" });
    expect(screen.queryByText("내용 a")).toBeNull();
    expect(screen.getByRole("heading", { name: "댓글 1" })).toBeInTheDocument();
  });

  test("created 이벤트(상위) → 새 댓글 추가 + 총 개수 증가", () => {
    renderSection([node("a")]);
    emit({ kind: "created", parentId: null, node: node("c") });
    expect(screen.getByText("내용 c")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "댓글 2" })).toBeInTheDocument();
  });

  test("feedLike 이벤트는 댓글 트리에 영향 없음", () => {
    renderSection([node("a")]);
    emit({ kind: "feedLike", count: 5 });
    expect(screen.getByRole("heading", { name: "댓글 1" })).toBeInTheDocument();
    expect(screen.getByText("내용 a")).toBeInTheDocument();
  });
});
