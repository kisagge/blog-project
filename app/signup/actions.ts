"use server";
import { headers } from "next/headers";
import { SignupSchema } from "@/lib/validation";
import { createPendingUser } from "@/lib/users";
import { verifyTurnstile } from "@/lib/turnstile";
import type { FormState } from "@/lib/form-state";

export type SignupState = FormState;

export async function signup(
  _state: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  const captcha = await verifyTurnstile(
    String(formData.get("cf-turnstile-response") ?? ""),
    ip,
  );
  if (!captcha)
    return { error: "사람 확인에 실패했습니다. 다시 시도해 주세요." };

  const parsed = SignupSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    nickname: String(formData.get("nickname") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const res = await createPendingUser(parsed.data);
  if (!res.ok) return { error: res.error };
  return { done: true };
}
