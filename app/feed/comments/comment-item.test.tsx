import { describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { CommentNode } from "@/lib/comments";

const { editCommentAction } = vi.hoisted(() => ({
  editCommentAction: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("./comment-actions", () => ({
  editCommentAction,
  addCommentAction: vi.fn(),
  toggleCommentLikeAction: vi.fn(),
}));
vi.mock("@/app/report/report-button", () => ({
  default: () => <button type="button">신고</button>,
}));

import CommentItem from "./comment-item";

function node(over: Partial<CommentNode> = {}): CommentNode {
  return {
    id: "c1",
    nickname: "철수",
    userId: "u1",
    authorRole: "member",
    content: "원본 내용",
    deleted: false,
    hidden: false,
    edited: false,
    createdAt: "2026-06-19T00:00:00.000Z",
    likeCount: 0,
    liked: false,
    replies: [],
    ...over,
  };
}

function renderItem(
  over: Partial<CommentNode> = {},
  props: Partial<Parameters<typeof CommentItem>[0]> = {},
) {
  return render(
    <CommentItem
      node={node(over)}
      feedId="f1"
      slug="hello"
      canParticipate
      isAdmin={false}
      linkAuthors
      onRequestDelete={props.onRequestDelete ?? vi.fn()}
      onCreatedReply={vi.fn()}
      onEdited={props.onEdited ?? vi.fn()}
      {...props}
    />,
  );
}

describe("CommentItem 렌더 상태", () => {
  test("회원 작성자 + linkAuthors → 프로필 링크", () => {
    renderItem();
    expect(screen.getByRole("link", { name: "철수" })).toHaveAttribute(
      "href",
      "/u/u1",
    );
  });

  test("linkAuthors=false → 평문(링크 없음)", () => {
    renderItem({}, { linkAuthors: false });
    expect(screen.queryByRole("link", { name: "철수" })).toBeNull();
    expect(screen.getByText("철수")).toBeInTheDocument();
  });

  test("edited → (수정됨) 표시", () => {
    renderItem({ edited: true });
    expect(screen.getByText("(수정됨)")).toBeInTheDocument();
  });

  test("deleted → 삭제 안내 + 작성자 '—'", () => {
    renderItem({ deleted: true });
    expect(screen.getByText("삭제된 댓글입니다.")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  test("hidden → 신고 가림 안내", () => {
    renderItem({ hidden: true });
    expect(screen.getByText("신고로 가려진 댓글입니다.")).toBeInTheDocument();
  });
});

describe("CommentItem 권한별 액션", () => {
  test("본인 댓글: 수정·삭제 노출, 삭제 클릭 시 onRequestDelete(id)", () => {
    const onRequestDelete = vi.fn();
    renderItem({}, { actorUserId: "u1", onRequestDelete });
    expect(screen.getByRole("button", { name: "수정" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(onRequestDelete).toHaveBeenCalledWith("c1");
  });

  test("타인 댓글(비admin): 수정·삭제 미노출", () => {
    renderItem({}, { actorUserId: "u2" });
    expect(screen.queryByRole("button", { name: "수정" })).toBeNull();
    expect(screen.queryByRole("button", { name: "삭제" })).toBeNull();
  });

  test("관리자: 타인 댓글에 삭제만(수정은 없음)", () => {
    renderItem({}, { actorUserId: "admin", isAdmin: true });
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "수정" })).toBeNull();
  });
});

describe("CommentItem 수정 흐름", () => {
  test("수정 클릭 → textarea, 저장 시 editCommentAction + onEdited 호출", async () => {
    const onEdited = vi.fn();
    renderItem({}, { actorUserId: "u1", onEdited });
    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    const ta = screen.getByRole("textbox", { name: "댓글 수정" });
    fireEvent.change(ta, { target: { value: "고친 내용" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() =>
      expect(editCommentAction).toHaveBeenCalledWith(
        "c1",
        "f1",
        "hello",
        "고친 내용",
      ),
    );
    expect(onEdited).toHaveBeenCalledWith("c1", "고친 내용");
  });
});
