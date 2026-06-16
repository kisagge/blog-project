"use server";
import { SignupSchema } from "@/lib/validation";
import { createPendingUser } from "@/lib/users";
import type { FormState } from "@/lib/form-state";

export type SignupState = FormState;

export async function signup(
  _state: SignupState,
  formData: FormData,
): Promise<SignupState> {
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
