import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";

type Mod = typeof import("@/lib/comments");
let m: Mod;
let prisma: import("@/app/generated/prisma/client").PrismaClient;
let cleanup: () => Promise<void>;
let feedId: string;
let alice: string;
let bob: string;

beforeAll(async () => {
  const db = await setupTestDb();
  prisma = db.prisma;
  cleanup = db.cleanup;
  const feed = await prisma.feed.create({
    data: { slug: "f1", title: "F", content: "c", published: true },
  });
  feedId = feed.id;
  const a = await prisma.user.create({
    data: {
      email: "a@x.com",
      nickname: "앨리스",
      passwordHash: "-",
      status: "approved",
    },
  });
  const b = await prisma.user.create({
    data: {
      email: "b@x.com",
      nickname: "밥",
      passwordHash: "-",
      status: "approved",
    },
  });
  alice = a.id;
  bob = b.id;
  m = await import("@/lib/comments");
});
afterAll(async () => {
  await cleanup();
});

describe("comments", () => {
  test("상위 댓글 생성 + 트리 조회", async () => {
    const r = await m.addComment({ feedId, userId: alice, content: "안녕" });
    expect(r.ok).toBe(true);
    const { items, total } = await m.getFeedComments(feedId);
    expect(items).toHaveLength(1);
    expect(total).toBe(1);
    expect(items[0].nickname).toBe("앨리스");
    expect(items[0].replies).toHaveLength(0);
  });
  test("대댓글(2뎁스)은 허용", async () => {
    const top = (await m.getFeedComments(feedId)).items[0];
    const r = await m.addComment({
      feedId,
      userId: bob,
      content: "답글",
      parentId: top.id,
    });
    expect(r.ok).toBe(true);
    const { items } = await m.getFeedComments(feedId);
    expect(items[0].replies).toHaveLength(1);
    expect(items[0].replies[0].nickname).toBe("밥");
  });
  test("대댓글에 답글(3뎁스)은 거부", async () => {
    const reply = (await m.getFeedComments(feedId)).items[0].replies[0];
    const r = await m.addComment({
      feedId,
      userId: alice,
      content: "x",
      parentId: reply.id,
    });
    expect(r).toEqual({
      ok: false,
      error: "대댓글에는 답글을 달 수 없습니다.",
    });
  });
  test("타인 댓글 삭제 거부, 본인은 허용", async () => {
    const top = (await m.getFeedComments(feedId)).items[0];
    expect(await m.deleteComment(top.id, bob)).toEqual({
      ok: false,
      error: "삭제 권한이 없습니다.",
    });
    expect((await m.deleteComment(top.id, alice)).ok).toBe(true);
    const { items } = await m.getFeedComments(feedId);
    expect(items[0].deleted).toBe(true);
    expect(items[0].replies).toHaveLength(1);
  });
  test("admin은 모든 댓글 삭제 가능(isAdmin)", async () => {
    const r = await m.addComment({ feedId, userId: alice, content: "또" });
    const id = (r as { ok: true; id: string }).id;
    expect((await m.deleteComment(id, bob, true)).ok).toBe(true);
    const { items } = await m.getFeedComments(feedId);
    expect(items.some((c) => c.id === id)).toBe(false);
  });

  test("인기순 정렬: 좋아요 많은 상위 댓글이 먼저, 대댓글은 시간순 유지", async () => {
    const cl = await import("@/lib/comment-likes");
    const f2 = await prisma.feed.create({
      data: { slug: "f2", title: "F2", content: "c", published: true },
    });
    const older = (await m.addComment({
      feedId: f2.id,
      userId: alice,
      content: "오래된-인기",
    })) as { ok: true; id: string };
    await m.addComment({ feedId: f2.id, userId: bob, content: "최신-비인기" });
    await m.addComment({
      feedId: f2.id,
      userId: alice,
      content: "답1",
      parentId: older.id,
    });
    await m.addComment({
      feedId: f2.id,
      userId: bob,
      content: "답2",
      parentId: older.id,
    });
    await cl.toggleCommentLike(older.id, alice);
    await cl.toggleCommentLike(older.id, bob);

    const popular = await m.getFeedComments(f2.id, { sort: "popular" });
    expect(popular.items.map((c) => c.content)).toEqual([
      "오래된-인기",
      "최신-비인기",
    ]);
    expect(popular.items[0].replies.map((r) => r.content)).toEqual([
      "답1",
      "답2",
    ]);

    const newest = await m.getFeedComments(f2.id, { sort: "newest" });
    expect(newest.items.map((c) => c.content)).toEqual([
      "최신-비인기",
      "오래된-인기",
    ]);
  });

  test("페이지네이션: skip/take로 상위 댓글 분할, total은 전체", async () => {
    const f3 = await prisma.feed.create({
      data: { slug: "f3", title: "F3", content: "c", published: true },
    });
    for (let i = 0; i < 30; i++) {
      await m.addComment({ feedId: f3.id, userId: alice, content: `c${i}` });
    }
    const p1 = await m.getFeedComments(f3.id, { sort: "newest", take: 25 });
    expect(p1.items).toHaveLength(25);
    expect(p1.total).toBe(30);
    const p2 = await m.getFeedComments(f3.id, {
      sort: "newest",
      skip: 25,
      take: 25,
    });
    expect(p2.items).toHaveLength(5);
    expect(p2.total).toBe(30);
  });
});
