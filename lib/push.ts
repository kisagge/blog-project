import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { swallow } from "@/lib/log";
import { isAllowedPushEndpoint } from "@/lib/push-endpoint";

// 회원당 보관할 구독 수(기기·브라우저별 1개). 넘치면 오래된 것부터 정리 — 무한 누적·발송 폭증 방지.
export const MAX_SUBSCRIPTIONS = 10;

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
  const stale = await prisma.pushSubscription.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: MAX_SUBSCRIPTIONS,
    select: { id: true },
  });
  if (stale.length > 0)
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: stale.map((s) => s.id) } },
    });
}

// 본인 구독만 삭제(endpoint만으로 지우면 남의 구독도 지울 수 있음).
export async function removeSubscription(userId: string, endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

type Payload = { title: string; body: string; url?: string };

type StoredSub = { endpoint: string; p256dh: string; auth: string };

// 구독 목록에 병렬 전송(개별 실패 격리 + 만료 구독 일괄 정리). sendToUser·sendToUsers 공용.
async function sendToSubs(subs: StoredSub[], payload: Payload) {
  // 검증 도입 전에 저장된 비허용 endpoint는 보내지 않고 정리 대상으로(SSRF 방지).
  const dead = subs
    .filter((s) => !isAllowedPushEndpoint(s.endpoint))
    .map((s) => s.endpoint);
  await Promise.all(
    subs
      .filter((s) => isAllowedPushEndpoint(s.endpoint))
      .map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload),
          );
        } catch (e) {
          const code = (e as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) dead.push(s.endpoint); // 만료/무효 → 일괄 삭제 대상
        }
      }),
  );
  // 죽은 구독은 건별이 아니라 한 번에 삭제(쿼리 1개).
  if (dead.length > 0) {
    await prisma.pushSubscription
      .deleteMany({ where: { endpoint: { in: dead } } })
      .catch(swallow("push:cleanup"));
  }
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
