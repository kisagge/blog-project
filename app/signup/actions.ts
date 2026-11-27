"use server";
import { SignupSchema, fieldErrors } from "@/lib/validation";
import { createPendingUser } from "@/lib/users";
import { guardPublicForm } from "@/lib/form-guard";
import { notifyAdminSignup } from "@/lib/notifications";
import { swallow } from "@/lib/log";
import { submittedValues, type FormState } from "@/lib/form-state";

export type SignupState = FormState;

export async function signup(
  _state: SignupState,
  formData: FormData,
): Promise<SignupState> {
  // 가입 스팸·이메일 열거 방지(IP당 한도 + CAPTCHA).
  const values = submittedValues(formData, ["email", "nickname"]); // 비밀번호 제외
  const blocked = await guardPublicForm("signup", formData);
  if (blocked) return { error: blocked, values };

  const parsed = SignupSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    nickname: String(formData.get("nickname") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const res = await createPendingUser(parsed.data);
  if (!res.ok) return { error: res.error, values };
  // 관리자에게 새 신청 알림(best-effort — 알림 실패가 가입 접수를 막지 않게).
  try {
    await notifyAdminSignup(parsed.data.nickname.trim());
  } catch (e) {
    swallow("signup:notify-admin")(e);
  }
  return { done: true };
}
