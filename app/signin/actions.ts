"use server";
import { redirect } from "next/navigation";
import { authenticateMember } from "@/lib/users";
import { createMemberSession } from "@/lib/session";
import { verifyTurnstile } from "@/lib/turnstile";
import { getClientIp } from "@/lib/client-ip";
import { allowAction, TOO_MANY_REQUESTS } from "@/lib/rate-limit";
import type { SimpleFormState } from "@/lib/form-state";

export type SigninState = SimpleFormState;

export async function signin(
  _state: SigninState,
  formData: FormData,
): Promise<SigninState> {
  const ip = (await getClientIp()) ?? "unknown";
  // 로그인 브루트포스 방지(IP당) — turnstile 앞에서 싸게 차단, 비활성 시에도 동작.
  if (!allowAction("signin", ip)) return { error: TOO_MANY_REQUESTS };
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
