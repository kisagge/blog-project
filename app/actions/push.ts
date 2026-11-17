"use server";
import { getMemberSession } from "@/lib/dal";
import { saveSubscription, removeSubscription } from "@/lib/push";
import { PushSubscriptionSchema } from "@/lib/validation";
import { allowAction } from "@/lib/rate-limit";

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };

// 서버 액션 인자는 클라이언트가 임의로 보낼 수 있어 런타임 검증 필수 — 서버가 endpoint로 직접 요청을
// 보내므로 푸시 서비스 허용 목록 외 주소(내부망 등)는 저장하지 않는다(SSRF 방지).
export async function subscribePush(sub: Sub): Promise<{ ok: boolean }> {
  const session = await getMemberSession();
  if (!session) return { ok: false };
  if (!allowAction("pushSubscribe", session.userId)) return { ok: false };
  const parsed = PushSubscriptionSchema.safeParse(sub);
  if (!parsed.success) return { ok: false };
  await saveSubscription(session.userId, parsed.data);
  return { ok: true };
}

// 본인 구독만 해제(이전엔 로그인 없이 endpoint만으로 아무 구독이나 지울 수 있었음).
export async function unsubscribePush(
  endpoint: string,
): Promise<{ ok: boolean }> {
  const session = await getMemberSession();
  if (!session || typeof endpoint !== "string") return { ok: false };
  await removeSubscription(session.userId, endpoint);
  return { ok: true };
}
