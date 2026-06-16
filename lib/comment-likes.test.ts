import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";
import { makeUser, makeFeed } from "@/lib/test-factories";

type CL = typeof import("@/lib/comment-likes");
type C = typeof import("@/lib/comments");
let cl: CL;
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
  cl = await import("@/lib/comment-likes");
  c = await import("@/lib/comments");
  const r = await c.addComment({ feedId, userId: u1, content: "댓글" });
  commentId = (r as { ok: true; id: string }).id;
});
afterAll(async () => {
  await cleanup();
});

describe("comment likes", () => {
  test("토글: 생성/취소 + 트리에 likeCount·liked 반영", async () => {
    expect(await cl.toggleCommentLike(commentId, u1)).toBe(true);
    expect(await cl.toggleCommentLike(commentId, u2)).toBe(true);
    const tree = await c.getFeedComments(feedId, { viewerUserId: u1 });
    expect(tree.items[0].likeCount).toBe(2);
    expect(tree.items[0].liked).toBe(true);
    // 안 누른 뷰어
    const tree2 = await c.getFeedComments(feedId, { viewerUserId: undefined });
    expect(tree2.items[0].liked).toBe(false);
    // 취소
    expect(await cl.toggleCommentLike(commentId, u1)).toBe(false);
    expect((await c.getFeedComments(feedId)).items[0].likeCount).toBe(1);
  });
});
