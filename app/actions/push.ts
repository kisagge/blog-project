"use server";
import { getSession } from "@/lib/dal";
import { saveSubscription, removeSubscription } from "@/lib/push";

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function subscribePush(sub: Sub): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (session?.role !== "member") return { ok: false };
  await saveSubscription(session.userId, sub);
  return { ok: true };
}

export async function unsubscribePush(
  endpoint: string,
): Promise<{ ok: boolean }> {
  await removeSubscription(endpoint);
  return { ok: true };
}
