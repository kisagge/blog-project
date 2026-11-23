"use server";
import { redirect } from "next/navigation";
import { authenticateMember } from "@/lib/users";
import { createMemberSession } from "@/lib/session";
import { guardPublicForm } from "@/lib/form-guard";
import type { SimpleFormState } from "@/lib/form-state";

export type SigninState = SimpleFormState;

export async function signin(
  _state: SigninState,
  formData: FormData,
): Promise<SigninState> {
  // 로그인 브루트포스 방지(IP당 한도 + CAPTCHA).
  const blocked = await guardPublicForm("signin", formData);
  if (blocked) return { error: blocked };

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const res = await authenticateMember(email, password);
  if (!res.ok) return { error: res.error };
  await createMemberSession(
    res.user.id,
    res.user.nickname,
    res.user.sessionVersion,
  );
  redirect("/");
}
