import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/comment-actor", () => ({ getCommentActor: vi.fn() }));
vi.mock("@/lib/dal", () => ({
  getSession: vi.fn(async () => undefined),
  getViewerRole: vi.fn(async () => "anon"),
}));
vi.mock("@/lib/feed-access", () => ({
  getReadableFeed: vi.fn(),
  getReadableCommentFeed: vi.fn(),
  findCommentFeed: vi.fn(),
}));
vi.mock("@/lib/comments", () => ({
  COMMENT_PAGE_SIZE: 25,
  addComment: vi.fn(async () => ({ ok: true, id: "c-new" })),
  deleteComment: vi.fn(async () => ({ ok: true })),
  editComment: vi.fn(async () => ({ ok: true, content: "수정" })),
  getFeedComments: vi.fn(async () => ({ items: [], total: 0 })),
}));
vi.mock("@/lib/likes", () => ({
  toggleLike: vi.fn(async () => ({ liked: true, count: 1 })),
  getLikeSummary: vi.fn(async () => ({ count: 7, liked: true })),
}));
vi.mock("@/lib/comment-likes", () => ({
  toggleCommentLike: vi.fn(async () => ({ liked: true, count: 1 })),
}));
vi.mock("@/lib/comment-reactions", () => ({
  toggleCommentReaction: vi.fn(async () => ({ count: 1 })),
}));
vi.mock("@/lib/feed-reactions", () => ({
  toggleFeedReaction: vi.fn(async () => ({ count: 1 })),
  getFeedReactionSummary: vi.fn(async () => [
    { emoji: "👍", count: 1, reacted: false },
  ]),
}));
vi.mock("@/lib/notifications", () => ({
  notifyCommentReply: vi.fn(async () => {}),
  notifyFeedComment: vi.fn(async () => {}),
  notifyCommentMention: vi.fn(async () => {}),
}));
vi.mock("@/lib/events", () => ({
  publishComment: vi.fn(),
  publishFeedLike: vi.fn(),
  publishFeedReaction: vi.fn(),
}));

import * as A from "@/app/feed/comments/comment-actions";
import { getCommentActor } from "@/lib/comment-actor";
import { getViewerRole } from "@/lib/dal";
import {
  getReadableFeed,
  getReadableCommentFeed,
  findCommentFeed,
} from "@/lib/feed-access";
import {
  addComment,
  deleteComment,
  editComment,
  getFeedComments,
} from "@/lib/comments";
import { toggleLike, getLikeSummary } from "@/lib/likes";
import { toggleCommentLike } from "@/lib/comment-likes";
import { toggleCommentReaction } from "@/lib/comment-reactions";
import {
  toggleFeedReaction,
  getFeedReactionSummary,
} from "@/lib/feed-reactions";
import { notifyFeedComment, notifyCommentMention } from "@/lib/notifications";
import { publishComment, publishFeedLike } from "@/lib/events";
import { revalidatePath } from "next/cache";
import { ACTION_LIMITS, TOO_MANY_REQUESTS } from "@/lib/rate-limit";

const actor = vi.mocked(getCommentActor);
const role = vi.mocked(getViewerRole);
const gf = vi.mocked(getReadableFeed);
const gcf = vi.mocked(getReadableCommentFeed);
const fcf = vi.mocked(findCommentFeed);

const DB = { id: "feed-db", slug: "real-slug" };
let uid = 0;
const member = () => ({
  userId: `u${++uid}`,
  nickname: "회원",
  role: "member" as const,
});
const fd = (content: string) => {
  const f = new FormData();
  f.set("content", content);
  return f;
};

beforeEach(() => {
  vi.clearAllMocks();
  actor.mockResolvedValue(member());
  role.mockResolvedValue("anon");
  gf.mockResolvedValue(DB);
  gcf.mockResolvedValue(DB);
  fcf.mockResolvedValue(DB);
});

describe("접근 게이트: 읽을 수 없는 글이면 아무것도 하지 않음", () => {
  beforeEach(() => {
    gf.mockResolvedValue(null);
    gcf.mockResolvedValue(null);
  });

  test("댓글 작성 거부", async () => {
    const r = await A.addCommentAction(
      { feedId: "private-feed", slug: "x" },
      undefined,
      fd("몰래"),
    );
    expect(r).toEqual({ error: "글을 찾을 수 없습니다." });
    expect(addComment).not.toHaveBeenCalled();
  });

  test("댓글 목록(더보기·재동기화)은 빈 페이지", async () => {
    actor.mockResolvedValue(null);
    expect(await A.loadMoreCommentsAction("f", "newest", 0)).toEqual({
      items: [],
      total: 0,
    });
    expect(await A.resyncCommentsAction("f", "newest", 10)).toEqual({
      items: [],
      total: 0,
    });
    expect(getFeedComments).not.toHaveBeenCalled();
    expect(gf).toHaveBeenCalledWith("f", "anon");
  });

  test("좋아요·리액션 요약은 빈 값, 토글은 미호출", async () => {
    expect(await A.getLikeSummaryAction("f")).toEqual({
      count: 0,
      liked: false,
    });
    expect(await A.getFeedReactionSummaryAction("f")).toEqual([]);
    await A.toggleLikeAction("f", "x");
    await A.toggleFeedReactionAction("f", "x", "👍");
    await A.toggleCommentLikeAction("c", "f", "x");
    await A.toggleCommentReactionAction("c", "f", "x", "👍");
    expect(getLikeSummary).not.toHaveBeenCalled();
    expect(getFeedReactionSummary).not.toHaveBeenCalled();
    expect(toggleLike).not.toHaveBeenCalled();
    expect(toggleFeedReaction).not.toHaveBeenCalled();
    expect(toggleCommentLike).not.toHaveBeenCalled();
    expect(toggleCommentReaction).not.toHaveBeenCalled();
  });

  test("댓글 수정 거부", async () => {
    expect(await A.editCommentAction("c", "f", "x", "수정")).toEqual({
      error: "글을 찾을 수 없습니다.",
    });
    expect(editComment).not.toHaveBeenCalled();
  });
});

describe("클라이언트가 보낸 feedId·slug 대신 DB 값을 사용", () => {
  test("댓글 작성: 알림 링크·리밸리데이트·실시간 전파가 DB 글 기준", async () => {
    const r = await A.addCommentAction(
      { feedId: "feed-db", slug: "phishing-slug" },
      undefined,
      fd("안녕 @누구"),
    );
    expect(r).toMatchObject({ comment: { id: "c-new" } });
    expect(addComment).toHaveBeenCalledWith(
      expect.objectContaining({ feedId: "feed-db" }),
    );
    expect(vi.mocked(notifyFeedComment).mock.calls[0][0]).toMatchObject({
      slug: "real-slug",
    });
    expect(vi.mocked(notifyCommentMention).mock.calls[0][0]).toMatchObject({
      slug: "real-slug",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/feed/real-slug");
    expect(vi.mocked(publishComment).mock.calls[0][0]).toBe("feed-db");
  });

  test("댓글 좋아요: 댓글이 실제로 속한 글로 전파(다른 글 feedId 무시)", async () => {
    await A.toggleCommentLikeAction("c1", "other-feed", "other-slug");
    expect(gcf).toHaveBeenCalledWith("c1", "member");
    expect(vi.mocked(publishComment).mock.calls[0][0]).toBe("feed-db");
    expect(revalidatePath).toHaveBeenCalledWith("/feed/real-slug");
  });

  test("글 좋아요: DB 글 id로 토글·전파", async () => {
    await A.toggleLikeAction("feed-db", "other-slug");
    expect(toggleLike).toHaveBeenCalledWith("feed-db", expect.any(String));
    expect(publishFeedLike).toHaveBeenCalledWith("feed-db", 1);
    expect(revalidatePath).toHaveBeenCalledWith("/feed/real-slug");
  });

  test("댓글 삭제: 본인 댓글은 글 공개 상태와 무관하게 삭제, 전파는 DB 글로", async () => {
    gcf.mockResolvedValue(null); // 글이 숨김 처리돼도 본인 댓글 삭제는 허용
    await A.deleteCommentAction("c1", "other-feed", "other-slug");
    expect(deleteComment).toHaveBeenCalled();
    expect(publishComment).toHaveBeenCalledWith("feed-db", {
      kind: "deleted",
      id: "c1",
    });
  });
});

describe("요청 제한·인자 정규화", () => {
  test("댓글 작성은 회원별 한도 초과 시 차단", async () => {
    const me = member();
    actor.mockResolvedValue(me);
    const { limit } = ACTION_LIMITS.comment;
    for (let i = 0; i < limit; i++)
      await A.addCommentAction({ feedId: "f", slug: "s" }, undefined, fd("a"));
    expect(
      await A.addCommentAction({ feedId: "f", slug: "s" }, undefined, fd("a")),
    ).toEqual({ error: TOO_MANY_REQUESTS });
    expect(addComment).toHaveBeenCalledTimes(limit);
  });

  test("재동기화 take 상한·sort/skip 정규화", async () => {
    await A.resyncCommentsAction("f", "weird" as never, 1_000_000);
    expect(getFeedComments).toHaveBeenLastCalledWith("feed-db", {
      sort: "popular",
      skip: 0,
      take: 200,
      viewerUserId: expect.any(String),
    });
    await A.loadMoreCommentsAction("f", "newest", -5);
    expect(getFeedComments).toHaveBeenLastCalledWith("feed-db", {
      sort: "newest",
      skip: 0,
      viewerUserId: expect.any(String),
    });
  });
});
