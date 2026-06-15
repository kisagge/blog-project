"use server";
import { revalidatePath } from "next/cache";
import { markAllRead, notificationRecipientId } from "@/lib/notifications";

export async function markNotificationsReadAction() {
  const recipientId = await notificationRecipientId();
  if (!recipientId) return;
  await markAllRead(recipientId);
  revalidatePath("/", "layout"); // 헤더 벨 배지 갱신
}
