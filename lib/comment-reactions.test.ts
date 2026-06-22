import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";
import { makeUser, makeFeed } from "@/lib/test-factories";

type CR = typeof import("@/lib/comment-reactions");
type C = typeof import("@/lib/comments");
let cr: CR;
let c: C;
let prisma: import("@/app/generated/prisma/client").PrismaClient;
let cleanup: () => Promise<void>;
let feedId: string, u1: string, u2: string, commentId: string;

beforeAll(async () => {
  const db = await setupTestDb();
  prisma = db.prisma;
  cleanup = db.cleanup;
  feedId = (await makeFeed(prisma)).id;
  u1 = (await makeUser(prisma)).id;
  u2 = (await makeUser(prisma)).id;
  cr = await import("@/lib/comment-reactions");
  c = await import("@/lib/comments");
  const r = await c.addComment({ feedId, userId: u1, content: "댓글" });
  commentId = (r as { ok: true; id: string }).id;
});
afterAll(async () => {
  await cleanup();
});

describe("comment reactions", () => {
  test("토글: 생성/취소 + 이모지별 카운트", async () => {
    expect(await cr.toggleCommentReaction(commentId, u1, "👍")).toEqual({
      reacted: true,
      count: 1,
    });
    expect(await cr.toggleCommentReaction(commentId, u2, "👍")).toEqual({
      reacted: true,
      count: 2,
    });
    // 취소
    expect(await cr.toggleCommentReaction(commentId, u1, "👍")).toEqual({
      reacted: false,
      count: 1,
    });
  });

  test("같은 (댓글,회원,이모지) 중복 누름은 토글(유니크)", async () => {
    await cr.toggleCommentReaction(commentId, u1, "🎉"); // on
    await cr.toggleCommentReaction(commentId, u1, "🎉"); // off
    const n = await prisma.commentReaction.count({
      where: { commentId, userId: u1, emoji: "🎉" },
    });
    expect(n).toBe(0);
  });

  test("서로 다른 이모지는 독립 카운트", async () => {
    await cr.toggleCommentReaction(commentId, u1, "😂"); // u1 😂
    await cr.toggleCommentReaction(commentId, u2, "😮"); // u2 😮
    const sums = await cr.getReactionSummaries([commentId], u1);
    const list = sums.get(commentId) ?? [];
    const byEmoji = Object.fromEntries(list.map((r) => [r.emoji, r]));
    expect(byEmoji["👍"].count).toBe(1); // u2만 남음
    expect(byEmoji["😂"]).toEqual({ emoji: "😂", count: 1, reacted: true }); // u1
    expect(byEmoji["😮"]).toEqual({ emoji: "😮", count: 1, reacted: false }); // u2(내 것 아님)
    // 세트 순서 유지(👍 😂 😮 …)
    expect(list.map((r) => r.emoji)).toEqual(["👍", "😂", "😮"]);
  });

  test("세트 외 이모지는 거부", async () => {
    await expect(
      cr.toggleCommentReaction(commentId, u1, "💩"),
    ).rejects.toThrow();
  });

  test("getFeedComments 노드에 reactions(카운트+reacted) 부착", async () => {
    const tree = await c.getFeedComments(feedId, { viewerUserId: u1 });
    const node = tree.items.find((n) => n.id === commentId)!;
    const byEmoji = Object.fromEntries(node.reactions.map((r) => [r.emoji, r]));
    expect(byEmoji["😂"]?.reacted).toBe(true); // u1 본인
    // 비로그인 뷰어는 reacted 모두 false
    const anon = await c.getFeedComments(feedId, { viewerUserId: undefined });
    const anonNode = anon.items.find((n) => n.id === commentId)!;
    expect(anonNode.reactions.every((r) => r.reacted === false)).toBe(true);
  });

  test("가려진(숨김) 댓글은 reactions 비노출", async () => {
    const r = await c.addComment({
      feedId,
      userId: u1,
      content: "신고될 댓글",
    });
    const hidId = (r as { ok: true; id: string }).id;
    await cr.toggleCommentReaction(hidId, u2, "👍");
    await prisma.comment.update({
      where: { id: hidId },
      data: { hiddenAt: new Date() },
    });
    const tree = await c.getFeedComments(feedId, { viewerUserId: u2 });
    const node = tree.items.find((n) => n.id === hidId)!;
    expect(node.hidden).toBe(true);
    expect(node.reactions).toEqual([]);
  });
});
