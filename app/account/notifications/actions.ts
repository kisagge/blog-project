"use server";
import { revalidatePath } from "next/cache";
import { getMemberSession } from "@/lib/dal";
import { setNotificationPrefs } from "@/lib/notifications";
import type { FormState } from "@/lib/form-state";

export type NotifPrefsState = FormState;

// 알림 환경설정 저장. 체크 안 된 체크박스는 FormData에 없으므로 "on" 비교로 판정.
export async function updateNotificationPrefsAction(
  _state: NotifPrefsState,
  formData: FormData,
): Promise<NotifPrefsState> {
  const session = await getMemberSession();
  if (!session) return { error: "로그인이 필요합니다." };
  await setNotificationPrefs(session.userId, {
    onReply: formData.get("onReply") === "on",
    onComment: formData.get("onComment") === "on",
  });
  revalidatePath("/account/notifications");
  return { done: true };
}
