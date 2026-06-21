import "server-only";
import { prisma } from "@/lib/prisma";
import { sendToUser, sendToUsers } from "@/lib/push";
import { getSession } from "@/lib/dal";
import { ensureAdminUser, ADMIN_EMAIL } from "@/lib/comment-actor";
import { publishUnread } from "@/lib/events";

// 회원 알림 환경설정(종류별 on/off). off면 해당 이벤트는 인앱·푸시 모두 미생성.
export type NotificationPrefs = {
  onReply: boolean;
  onComment: boolean;
  onMention: boolean;
  onFollow: boolean;
};

export async function getNotificationPrefs(
  userId: string,
): Promise<NotificationPrefs> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      notifyOnReply: true,
      notifyOnComment: true,
      notifyOnMention: true,
      notifyOnFollow: true,
    },
  });
  return {
    onReply: u?.notifyOnReply ?? true,
    onComment: u?.notifyOnComment ?? true,
    onMention: u?.notifyOnMention ?? true,
    onFollow: u?.notifyOnFollow ?? true,
  };
}

export async function setNotificationPrefs(
  userId: string,
  prefs: NotificationPrefs,
) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      notifyOnReply: prefs.onReply,
      notifyOnComment: prefs.onComment,
      notifyOnMention: prefs.onMention,
      notifyOnFollow: prefs.onFollow,
    },
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

// 여러 회원에게 동일 알림을 일괄 생성 + 각자 SSE 미읽음 수 반영(N+1 회피).
// createMany는 전부-또는-전무지만 호출부가 fire-and-forget(.catch)라 부분 실패 격리는
// 불필요 — 균일 insert라 부분 실패도 사실상 없음.
async function createNotifications(
  userIds: string[],
  body: string,
  url?: string,
) {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({ userId, body, url })),
  });
  // 대상별 미읽음 수를 한 번에 집계해 각 열린 탭(SSE)에 반영.
  const counts = await prisma.notification.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds }, readAt: null },
    _count: { _all: true },
  });
  const countMap = new Map(counts.map((c) => [c.userId, c._count._all]));
  for (const userId of userIds)
    publishUnread(userId, countMap.get(userId) ?? 0);
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

// 팔로우 → 팔로우당한 회원에게 알림 + 푸시. 수신자가 팔로우 알림을 끄면 미생성.
// url은 팔로워 프로필로 딥링크. (followUser가 신규 생성 시에만 호출.)
export async function notifyFollow(args: {
  followingId: string;
  fromUserId: string;
  fromNickname: string;
}) {
  const target = await prisma.user.findUnique({
    where: { id: args.followingId },
    select: { notifyOnFollow: true },
  });
  if (!target || !target.notifyOnFollow) return;
  const body = `${args.fromNickname}님이 회원님을 팔로우했습니다.`;
  const url = `/u/${args.fromUserId}`;
  await createNotification(args.followingId, body, url);
  await sendToUser(args.followingId, { title: "새 팔로워", body, url });
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

// 댓글 본문의 @닉네임 멘션 → 멘션된 승인 회원에게 인앱+푸시.
// 닉네임은 DB 유일 제약 없음 + 공백·구두점 허용이라 정규식 파싱이 어려워,
// 승인 회원을 순회하며 content에 "@<닉네임>"이 들어있는지로 느슨 매칭한다.
// 느슨 매칭을 택한 이유: 한국어 존칭/조사(@닉네임'님'/'아')도 멘션으로 잡기 위함.
// 한계: 어떤 닉네임이 다른 닉네임의 접두면 과매칭(예 "철수"가 "@철수네"에도 매칭)될 수 있다 — 드물고 알림 1건 추가 수준이라 수용.
export async function notifyCommentMention(args: {
  content: string;
  commentId: string;
  slug: string;
  fromUserId: string;
  fromNickname: string;
}) {
  const members = await prisma.user.findMany({
    where: { role: "member", status: "approved" },
    select: { id: true, nickname: true, notifyOnMention: true },
  });
  const url = `/feed/${args.slug}?c=${args.commentId}`;
  const body = `${args.fromNickname}님이 회원님을 멘션했습니다.`;
  // 멘션 대상(본인·off·미멘션 제외)을 모은 뒤 인앱·푸시를 각각 한 번에(대상 수 무관 상수 쿼리).
  const targets = members
    .filter(
      (mb) =>
        mb.id !== args.fromUserId &&
        mb.notifyOnMention &&
        args.content.includes(`@${mb.nickname}`),
    )
    .map((mb) => mb.id);
  if (targets.length === 0) return;
  await createNotifications(targets, body, url);
  await sendToUsers(targets, { title: "멘션", body, url });
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
