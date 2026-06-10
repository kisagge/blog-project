"use server";
import { redirect } from "next/navigation";
import { authenticateMember } from "@/lib/users";
import { createMemberSession } from "@/lib/session";

export type SigninState = { error?: string } | undefined;

export async function signin(
  _state: SigninState,
  formData: FormData,
): Promise<SigninState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const res = await authenticateMember(email, password);
  if (!res.ok) return { error: res.error };
  await createMemberSession(res.user.id, res.user.nickname);
  redirect("/");
}
