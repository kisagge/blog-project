import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { setupTestDb } from "@/lib/test-db";

vi.mock("server-only", () => ({}));
const { sendNotification } = vi.hoisted(() => ({ sendNotification: vi.fn() }));
vi.mock("web-push", () => ({
  default: { setVapidDetails: vi.fn(), sendNotification },
}));

type Push = typeof import("@/lib/push");
type Prisma = (typeof import("@/lib/prisma"))["prisma"];
let push: Push;
let prisma: Prisma;
let cleanup: () => Promise<void>;
let authorId: string;
let replierId: string;
let parentId: string;

beforeAll(async () => {
  process.env.VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
  sendNotification.mockResolvedValue(undefined);
  const db = await setupTestDb();
  cleanup = db.cleanup;
  prisma = db.prisma as Prisma;
  push = await import("@/lib/push");

  const feed = await prisma.feed.create({
    data: { slug: "p", title: "T", content: "c", visibility: "public" },
  });
  const a = await prisma.user.create({
    data: { email: "a@x.com", nickname: "A", passwordHash: "-" },
  });
  const b = await prisma.user.create({
    data: { email: "b@x.com", nickname: "B", passwordHash: "-" },
  });
  authorId = a.id;
  replierId = b.id;
  const c = await prisma.comment.create({
    data: { feedId: feed.id, userId: a.id, content: "원댓글" },
  });
  parentId = c.id;
  await push.saveSubscription(a.id, {
    endpoint: "https://push/a",
    keys: { p256dh: "x", auth: "y" },
  });
});
afterAll(async () => {
  await cleanup();
});

describe("push", () => {
  test("saveSubscription: 저장됨(endpoint 유니크)", async () => {
    expect(
      await prisma.pushSubscription.count({ where: { userId: authorId } }),
    ).toBe(1);
  });

  test("notifyCommentReply: 타인 답글이면 원작성자에게 발송", async () => {
    sendNotification.mockClear();
    await push.notifyCommentReply({
      parentId,
      slug: "p",
      fromUserId: replierId,
      fromNickname: "B",
      content: "답글 내용",
    });
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });

  test("notifyCommentReply: 본인 답글이면 미발송", async () => {
    sendNotification.mockClear();
    await push.notifyCommentReply({
      parentId,
      slug: "p",
      fromUserId: authorId,
      fromNickname: "A",
      content: "셀프",
    });
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
