import "server-only";
import { prisma } from "@/lib/prisma";
import { sendToUser } from "@/lib/push";
import { getSession } from "@/lib/dal";
import { ensureAdminUser, ADMIN_EMAIL } from "@/lib/comment-actor";

export async function createNotification(
  userId: string,
  body: string,
  url?: string,
) {
  await prisma.notification.create({ data: { userId, body, url } });
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
    select: { userId: true },
  });
  if (!parent || parent.userId === args.fromUserId) return;
  const body = `${args.fromNickname}님이 회원님의 댓글에 답글을 남겼습니다.`;
  const url = `/feed/${args.slug}?c=${args.commentId}`;
  await createNotification(parent.userId, body, url);
  await sendToUser(parent.userId, { title: "새 답글", body, url });
}

// 최상위 댓글 → 글 주인(현재는 관리자)에게 알림. 본인 댓글이면 제외. url은 댓글로 딥링크.
// 추후 유저 작성 글이 생기면 ensureAdminUser → 글 작성자로 일반화.
export async function notifyFeedComment(args: {
  feedId: string;
  commentId: string;
  slug: string;
  fromUserId: string;
  fromNickname: string;
}) {
  const admin = await ensureAdminUser();
  if (admin.id === args.fromUserId) return;
  const feed = await prisma.feed.findUnique({
    where: { id: args.feedId },
    select: { title: true },
  });
  const body = `${args.fromNickname}님이 '${feed?.title ?? "글"}'에 댓글을 남겼습니다.`;
  const url = `/feed/${args.slug}?c=${args.commentId}`;
  await createNotification(admin.id, body, url);
  await sendToUser(admin.id, { title: "새 댓글", body, url });
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
