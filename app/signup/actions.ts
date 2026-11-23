"use server";
import { SignupSchema, fieldErrors } from "@/lib/validation";
import { createPendingUser } from "@/lib/users";
import { guardPublicForm } from "@/lib/form-guard";
import type { FormState } from "@/lib/form-state";

export type SignupState = FormState;

export async function signup(
  _state: SignupState,
  formData: FormData,
): Promise<SignupState> {
  // 가입 스팸·이메일 열거 방지(IP당 한도 + CAPTCHA).
  const blocked = await guardPublicForm("signup", formData);
  if (blocked) return { error: blocked };

  const parsed = SignupSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    nickname: String(formData.get("nickname") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const res = await createPendingUser(parsed.data);
  if (!res.ok) return { error: res.error };
  return { done: true };
}
