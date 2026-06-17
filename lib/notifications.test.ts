import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { setupTestDb } from "@/lib/test-db";

vi.mock("server-only", () => ({}));
const { sendNotification } = vi.hoisted(() => ({ sendNotification: vi.fn() }));
vi.mock("web-push", () => ({
  default: { setVapidDetails: vi.fn(), sendNotification },
}));

type Notif = typeof import("@/lib/notifications");
type Prisma = (typeof import("@/lib/prisma"))["prisma"];
let m: Notif;
let prisma: Prisma;
let cleanup: () => Promise<void>;
let authorId: string;
let replierId: string;
let parentId: string;
let feedId: string;

beforeAll(async () => {
  process.env.VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
  sendNotification.mockResolvedValue(undefined);
  const db = await setupTestDb();
  cleanup = db.cleanup;
  prisma = db.prisma as Prisma;
  m = await import("@/lib/notifications");
  const feed = await prisma.feed.create({
    data: { slug: "p", title: "T", content: "c", visibility: "public" },
  });
  feedId = feed.id;
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
});
afterAll(async () => {
  await cleanup();
});

describe("notifications", () => {
  test("create/countUnread/markAllRead", async () => {
    await m.createNotification(authorId, "알림1", "/feed/p");
    await m.createNotification(authorId, "알림2");
    expect(await m.countUnread(authorId)).toBe(2);
    await m.markAllRead(authorId);
    expect(await m.countUnread(authorId)).toBe(0);
    const list = await m.listNotifications(authorId);
    expect(list).toHaveLength(2);
  });

  test("createNotification·markAllRead가 SSE 버스로 unread를 publish", async () => {
    const events = await import("@/lib/events");
    const recv: number[] = [];
    const off = events.subscribeUnread(replierId, (n) => recv.push(n));
    await m.createNotification(replierId, "버스알림1");
    await m.createNotification(replierId, "버스알림2");
    await m.markAllRead(replierId);
    off();
    expect(recv).toEqual([1, 2, 0]); // 누적 unread 1,2 → 읽음 0
  });

  test("notifyCommentReply: 타인 답글 → 알림 생성 + 푸시", async () => {
    sendNotification.mockClear();
    const before = await prisma.notification.count({
      where: { userId: authorId },
    });
    await m.notifyCommentReply({
      parentId,
      commentId: "reply1",
      slug: "p",
      fromUserId: replierId,
      fromNickname: "B",
      content: "답글",
    });
    const rows = await prisma.notification.findMany({
      where: { userId: authorId },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].url).toBe("/feed/p?c=reply1"); // 답글로 딥링크
    expect(
      await prisma.notification.count({ where: { userId: authorId } }),
    ).toBe(before + 1);
  });

  test("notifyCommentReply: 본인 답글이면 생성/발송 안 함", async () => {
    sendNotification.mockClear();
    const before = await prisma.notification.count({
      where: { userId: authorId },
    });
    await m.notifyCommentReply({
      parentId,
      commentId: "reply2",
      slug: "p",
      fromUserId: authorId,
      fromNickname: "A",
      content: "셀프",
    });
    expect(
      await prisma.notification.count({ where: { userId: authorId } }),
    ).toBe(before);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  test("notifyFeedComment: 최상위 댓글 → 관리자에게 알림(딥링크)", async () => {
    const { ensureAdminUser } = await import("@/lib/comment-actor");
    const admin = await ensureAdminUser();
    const before = await prisma.notification.count({
      where: { userId: admin.id },
    });
    await m.notifyFeedComment({
      feedId,
      commentId: "top1",
      slug: "p",
      fromUserId: replierId,
      fromNickname: "B",
    });
    const rows = await prisma.notification.findMany({
      where: { userId: admin.id },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    expect(rows[0].url).toBe("/feed/p?c=top1");
    expect(
      await prisma.notification.count({ where: { userId: admin.id } }),
    ).toBe(before + 1);
  });

  test("notifyFeedComment: 관리자 본인 댓글이면 스킵", async () => {
    const { ensureAdminUser } = await import("@/lib/comment-actor");
    const admin = await ensureAdminUser();
    const before = await prisma.notification.count({
      where: { userId: admin.id },
    });
    await m.notifyFeedComment({
      feedId,
      commentId: "top2",
      slug: "p",
      fromUserId: admin.id,
      fromNickname: "관리자",
    });
    expect(
      await prisma.notification.count({ where: { userId: admin.id } }),
    ).toBe(before);
  });

  test("notifyFeedComment: 회원 글이면 관리자 아닌 작성자에게 알림", async () => {
    // 작성자 A의 회원 글에 B가 댓글 → A에게 알림(관리자 아님).
    const memFeed = await prisma.feed.create({
      data: {
        slug: "mp",
        title: "회원글",
        content: "c",
        visibility: "members",
        status: "published",
        authorId,
      },
    });
    const before = await prisma.notification.count({
      where: { userId: authorId },
    });
    await m.notifyFeedComment({
      feedId: memFeed.id,
      commentId: "top3",
      slug: "mp",
      fromUserId: replierId,
      fromNickname: "B",
    });
    const rows = await prisma.notification.findMany({
      where: { userId: authorId },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    expect(rows[0].url).toBe("/feed/mp?c=top3");
    expect(
      await prisma.notification.count({ where: { userId: authorId } }),
    ).toBe(before + 1);
  });
});

describe("notification prefs", () => {
  test("getNotificationPrefs 기본값 true, setNotificationPrefs 갱신", async () => {
    const u = await prisma.user.create({
      data: { email: "pref@x.com", nickname: "P", passwordHash: "-" },
    });
    expect(await m.getNotificationPrefs(u.id)).toEqual({
      onReply: true,
      onComment: true,
    });
    await m.setNotificationPrefs(u.id, { onReply: false, onComment: true });
    expect(await m.getNotificationPrefs(u.id)).toEqual({
      onReply: false,
      onComment: true,
    });
  });

  test("notifyCommentReply: 수신자가 답글 알림 off면 미생성(on이면 생성)", async () => {
    const recipient = await prisma.user.create({
      data: {
        email: "r1@x.com",
        nickname: "R1",
        passwordHash: "-",
        notifyOnReply: false,
      },
    });
    const sender = await prisma.user.create({
      data: { email: "s1@x.com", nickname: "S1", passwordHash: "-" },
    });
    const feed = await prisma.feed.create({
      data: { slug: "pf1", title: "T", content: "c", visibility: "public" },
    });
    const parent = await prisma.comment.create({
      data: { feedId: feed.id, userId: recipient.id, content: "원댓글" },
    });
    sendNotification.mockClear();
    await m.notifyCommentReply({
      parentId: parent.id,
      commentId: "rx",
      slug: "pf1",
      fromUserId: sender.id,
      fromNickname: "S1",
      content: "답글",
    });
    expect(
      await prisma.notification.count({ where: { userId: recipient.id } }),
    ).toBe(0);
    expect(sendNotification).not.toHaveBeenCalled();
    // 켜면 생성됨
    await m.setNotificationPrefs(recipient.id, {
      onReply: true,
      onComment: true,
    });
    await m.notifyCommentReply({
      parentId: parent.id,
      commentId: "ry",
      slug: "pf1",
      fromUserId: sender.id,
      fromNickname: "S1",
      content: "답글2",
    });
    expect(
      await prisma.notification.count({ where: { userId: recipient.id } }),
    ).toBe(1);
  });

  test("notifyFeedComment: 글 주인이 댓글 알림 off면 미생성", async () => {
    const owner = await prisma.user.create({
      data: {
        email: "o1@x.com",
        nickname: "O1",
        passwordHash: "-",
        notifyOnComment: false,
      },
    });
    const commenter = await prisma.user.create({
      data: { email: "c1@x.com", nickname: "C1", passwordHash: "-" },
    });
    const feed = await prisma.feed.create({
      data: {
        slug: "pf2",
        title: "T",
        content: "c",
        visibility: "members",
        status: "published",
        authorId: owner.id,
      },
    });
    await m.notifyFeedComment({
      feedId: feed.id,
      commentId: "tx",
      slug: "pf2",
      fromUserId: commenter.id,
      fromNickname: "C1",
    });
    expect(
      await prisma.notification.count({ where: { userId: owner.id } }),
    ).toBe(0);
  });
});
