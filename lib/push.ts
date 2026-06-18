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

type StoredSub = { endpoint: string; p256dh: string; auth: string };

// 구독 목록에 병렬 전송(개별 실패 격리 + 만료 구독 정리). sendToUser·sendToUsers 공용.
async function sendToSubs(subs: StoredSub[], payload: Payload) {
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

export async function sendToUser(userId: string, payload: Payload) {
  if (!configure()) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  await sendToSubs(subs, payload);
}

// 여러 회원에게 한 번에(N+1 회피): 구독을 in 한 번에 조회 후 병렬 전송.
export async function sendToUsers(userIds: string[], payload: Payload) {
  if (!configure() || userIds.length === 0) return;
  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  });
  await sendToSubs(subs, payload);
}
