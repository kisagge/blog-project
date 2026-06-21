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
      onMention: true,
      onFollow: true,
    });
    await m.setNotificationPrefs(u.id, {
      onReply: false,
      onComment: true,
      onMention: false,
      onFollow: false,
    });
    expect(await m.getNotificationPrefs(u.id)).toEqual({
      onReply: false,
      onComment: true,
      onMention: false,
      onFollow: false,
    });
  });

  test("notifyCommentMention: @닉네임 멘션된 승인 회원에게 알림(본인·off·미멘션 제외)", async () => {
    const author = await prisma.user.create({
      data: {
        email: "ma@x.com",
        nickname: "멘션작성",
        passwordHash: "-",
        status: "approved",
      },
    });
    const target = await prisma.user.create({
      data: {
        email: "mt@x.com",
        nickname: "대상회원",
        passwordHash: "-",
        status: "approved",
      },
    });
    const other = await prisma.user.create({
      data: {
        email: "mo@x.com",
        nickname: "딴사람",
        passwordHash: "-",
        status: "approved",
      },
    });
    const offUser = await prisma.user.create({
      data: {
        email: "moff@x.com",
        nickname: "멘션끔",
        passwordHash: "-",
        status: "approved",
        notifyOnMention: false,
      },
    });
    const pending = await prisma.user.create({
      data: {
        email: "mp@x.com",
        nickname: "미승인",
        passwordHash: "-",
        status: "pending",
      },
    });
    const honor = await prisma.user.create({
      data: {
        email: "mh@x.com",
        nickname: "존칭회원",
        passwordHash: "-",
        status: "approved",
      },
    });
    sendNotification.mockClear();
    // 대상회원·멘션끔·미승인·본인(멘션작성) + 존칭(@존칭회원님)을 멘션
    await m.notifyCommentMention({
      content: "@대상회원 @멘션끔 @미승인 @멘션작성 @존칭회원님 안녕",
      commentId: "mc1",
      slug: "p",
      fromUserId: author.id,
      fromNickname: "멘션작성",
    });
    const got = async (id: string) =>
      prisma.notification.count({ where: { userId: id } });
    expect(await got(target.id)).toBe(1); // 멘션된 승인 회원
    expect(await got(honor.id)).toBe(1); // @존칭회원님 — 존칭 접미도 매칭(느슨)
    expect(await got(offUser.id)).toBe(0); // 멘션 알림 off
    expect(await got(pending.id)).toBe(0); // 비승인 회원
    expect(await got(author.id)).toBe(0); // 본인 멘션 제외
    expect(await got(other.id)).toBe(0); // 멘션 안 됨
    const rows = await prisma.notification.findMany({
      where: { userId: target.id },
      take: 1,
    });
    expect(rows[0].url).toBe("/feed/p?c=mc1");
  });

  test("notifyCommentMention: 멘션 대상 구독에만 푸시를 배치 전송", async () => {
    const from = await prisma.user.create({
      data: {
        email: "pf@x.com",
        nickname: "푸시작성",
        passwordHash: "-",
        status: "approved",
      },
    });
    const u1 = await prisma.user.create({
      data: {
        email: "p1@x.com",
        nickname: "푸시하나",
        passwordHash: "-",
        status: "approved",
      },
    });
    const u2 = await prisma.user.create({
      data: {
        email: "p2@x.com",
        nickname: "푸시둘",
        passwordHash: "-",
        status: "approved",
      },
    });
    const u3 = await prisma.user.create({
      data: {
        email: "p3@x.com",
        nickname: "푸시안됨",
        passwordHash: "-",
        status: "approved",
      },
    });
    // 각 회원 구독(미멘션 u3 포함) — u3 엔드포인트로는 전송되면 안 됨.
    for (const [u, ep] of [
      [u1, "https://push/ep1"],
      [u2, "https://push/ep2"],
      [u3, "https://push/ep3"],
    ] as const) {
      await prisma.pushSubscription.create({
        data: { userId: u.id, endpoint: ep, p256dh: "k", auth: "a" },
      });
    }
    sendNotification.mockClear();
    // 배치 증명: 대상이 여럿이어도 구독 조회는 단 한 번(in 절)이어야 N+1이 아님.
    const findManySpy = vi.spyOn(prisma.pushSubscription, "findMany");
    await m.notifyCommentMention({
      content: "@푸시하나 @푸시둘 확인",
      commentId: "mc2",
      slug: "p",
      fromUserId: from.id,
      fromNickname: "푸시작성",
    });
    expect(findManySpy).toHaveBeenCalledTimes(1); // 대상 수 무관 1쿼리
    findManySpy.mockRestore();
    const endpoints = sendNotification.mock.calls
      .map((c) => c[0].endpoint)
      .sort();
    expect(endpoints).toEqual(["https://push/ep1", "https://push/ep2"]);
    // 멘션 대상 둘 다 인앱 1건씩(createMany 경로).
    expect(await prisma.notification.count({ where: { userId: u1.id } })).toBe(
      1,
    );
    expect(await prisma.notification.count({ where: { userId: u2.id } })).toBe(
      1,
    );
    expect(await prisma.notification.count({ where: { userId: u3.id } })).toBe(
      0,
    );
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
      onMention: true,
      onFollow: true,
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

  test("notifyFollow: 팔로우 알림 off면 미생성, on이면 생성", async () => {
    const target = await prisma.user.create({
      data: {
        email: "ft@x.com",
        nickname: "FT",
        passwordHash: "-",
        notifyOnFollow: false,
      },
    });
    sendNotification.mockClear();
    await m.notifyFollow({
      followingId: target.id,
      fromUserId: "someone",
      fromNickname: "팔로워A",
    });
    expect(
      await prisma.notification.count({ where: { userId: target.id } }),
    ).toBe(0);
    expect(sendNotification).not.toHaveBeenCalled();
    // 켜면 생성
    await prisma.user.update({
      where: { id: target.id },
      data: { notifyOnFollow: true },
    });
    await m.notifyFollow({
      followingId: target.id,
      fromUserId: "someone",
      fromNickname: "팔로워A",
    });
    const n = await prisma.notification.findFirst({
      where: { userId: target.id },
    });
    expect(n?.body).toContain("팔로워A");
    expect(n?.url).toBe("/u/someone");
  });
});
