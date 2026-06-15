import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "https://by-jang-blog.xyz";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export function pushPublicKey(): string | undefined {
  return process.env.VAPID_PUBLIC_KEY || undefined;
}

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function saveSubscription(userId: string, sub: Sub) {
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    create: {
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
  });
}

export async function removeSubscription(endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

type Payload = { title: string; body: string; url?: string };

export async function sendToUser(userId: string, payload: Payload) {
  if (!configure()) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
      } catch (e) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          // 만료/무효 구독 정리.
          await prisma.pushSubscription
            .deleteMany({ where: { endpoint: s.endpoint } })
            .catch(() => {});
        }
      }
    }),
  );
}

// 답글 → 원댓글 작성자에게 푸시(본인 제외).
export async function notifyCommentReply(args: {
  parentId: string;
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
  await sendToUser(parent.userId, {
    title: "새 답글",
    body: `${args.fromNickname}: ${args.content.trim().slice(0, 50)}`,
    url: `/feed/${args.slug}`,
  });
}
