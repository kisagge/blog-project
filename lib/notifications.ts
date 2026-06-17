import "server-only";
import { prisma } from "@/lib/prisma";
import { sendToUser } from "@/lib/push";
import { getSession } from "@/lib/dal";
import { ensureAdminUser, ADMIN_EMAIL } from "@/lib/comment-actor";
import { publishUnread } from "@/lib/events";

// 회원 알림 환경설정(종류별 on/off). off면 해당 이벤트는 인앱·푸시 모두 미생성.
export async function getNotificationPrefs(
  userId: string,
): Promise<{ onReply: boolean; onComment: boolean }> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { notifyOnReply: true, notifyOnComment: true },
  });
  return {
    onReply: u?.notifyOnReply ?? true,
    onComment: u?.notifyOnComment ?? true,
  };
}

export async function setNotificationPrefs(
  userId: string,
  prefs: { onReply: boolean; onComment: boolean },
) {
  await prisma.user.update({
    where: { id: userId },
    data: { notifyOnReply: prefs.onReply, notifyOnComment: prefs.onComment },
  });
}

export async function createNotification(
  userId: string,
  body: string,
  url?: string,
) {
  await prisma.notification.create({ data: { userId, body, url } });
  // 열린 탭(SSE)에 미읽음 수 즉시 반영.
  publishUnread(userId, await countUnread(userId));
}

export async function listNotifications(userId: string, take = 30) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  publishUnread(userId, 0); // 다른 열린 탭 배지도 즉시 0
}

// 답글 → 원댓글 작성자에게 인앱 알림 생성 + 푸시(본인 제외). url은 답글로 딥링크.
export async function notifyCommentReply(args: {
  parentId: string;
  commentId: string;
  slug: string;
  fromUserId: string;
  fromNickname: string;
  content: string;
}) {
  const parent = await prisma.comment.findUnique({
    where: { id: args.parentId },
    select: { userId: true, user: { select: { notifyOnReply: true } } },
  });
  if (!parent || parent.userId === args.fromUserId) return;
  if (!parent.user.notifyOnReply) return; // 수신자가 답글 알림을 끔
  const body = `${args.fromNickname}님이 회원님의 댓글에 답글을 남겼습니다.`;
  const url = `/feed/${args.slug}?c=${args.commentId}`;
  await createNotification(parent.userId, body, url);
  await sendToUser(parent.userId, { title: "새 답글", body, url });
}

// 최상위 댓글 → 글 주인에게 알림. 회원 글이면 작성자(authorId), 관리자 글이면 예약 관리자.
// 본인 댓글이면 제외. url은 댓글로 딥링크.
export async function notifyFeedComment(args: {
  feedId: string;
  commentId: string;
  slug: string;
  fromUserId: string;
  fromNickname: string;
}) {
  const feed = await prisma.feed.findUnique({
    where: { id: args.feedId },
    select: { title: true, authorId: true },
  });
  const ownerId = feed?.authorId ?? (await ensureAdminUser()).id;
  if (ownerId === args.fromUserId) return;
  // 글 주인이 '내 글 댓글' 알림을 껐으면 미생성(admin 예약 User는 기본 true).
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { notifyOnComment: true },
  });
  if (!owner?.notifyOnComment) return;
  const body = `${args.fromNickname}님이 '${feed?.title ?? "글"}'에 댓글을 남겼습니다.`;
  const url = `/feed/${args.slug}?c=${args.commentId}`;
  await createNotification(ownerId, body, url);
  await sendToUser(ownerId, { title: "새 댓글", body, url });
}

// 새 신고 접수 → 예약 관리자에게 인앱 알림 + 푸시. 신고 큐로 딥링크.
export async function notifyAdminReport(args: {
  targetType: "comment" | "feed";
}) {
  const adminId = (await ensureAdminUser()).id;
  const what = args.targetType === "comment" ? "댓글" : "글";
  const body = `새 ${what} 신고가 접수되었습니다.`;
  const url = "/admin/reports";
  await createNotification(adminId, body, url);
  await sendToUser(adminId, { title: "새 신고", body, url });
}

// 알림 수신자 id: 회원은 본인, 관리자는 예약 관리자 User. 없으면 null.
export async function notificationRecipientId(): Promise<string | null> {
  const s = await getSession();
  if (s?.role === "member") return s.userId;
  if (s?.role === "admin") {
    const admin = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
      select: { id: true },
    });
    return admin?.id ?? null;
  }
  return null;
}
