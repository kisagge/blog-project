"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { authenticateMember } from "@/lib/users";
import { createMemberSession } from "@/lib/session";
import { verifyTurnstile } from "@/lib/turnstile";

export type SigninState = { error?: string } | undefined;

export async function signin(
  _state: SigninState,
  formData: FormData,
): Promise<SigninState> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  if (
    !(await verifyTurnstile(
      String(formData.get("cf-turnstile-response") ?? ""),
      ip,
    ))
  )
    return { error: "사람 확인에 실패했습니다. 다시 시도해 주세요." };

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const res = await authenticateMember(email, password);
  if (!res.ok) return { error: res.error };
  await createMemberSession(res.user.id, res.user.nickname);
  redirect("/");
}
