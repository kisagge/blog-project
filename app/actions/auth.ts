"use server";
import { timingSafeEqual } from "crypto";
import { redirect } from "next/navigation";
import { createAdminSession, deleteSession } from "@/lib/session";
import { verifyTotp } from "@/lib/totp";
import { getClientIp } from "@/lib/client-ip";
import { allowAction, TOO_MANY_REQUESTS } from "@/lib/rate-limit";

export type LoginState = { error?: string } | undefined;

function passwordMatches(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function login(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  // 무차별 대입 방지(IP당) — TOTP 미설정이면 비밀번호가 유일한 방어선.
  if (!allowAction("adminLogin", (await getClientIp()) ?? "unknown"))
    return { error: TOO_MANY_REQUESTS };
  const password = String(formData.get("password") ?? "");
  // ADMIN_TOTP_SECRET가 설정돼 있으면 2단계(비밀번호 + Google Authenticator OTP).
  // 미설정이면 비밀번호만으로 동작(롤아웃 중 잠김 방지).
  const secret = process.env.ADMIN_TOTP_SECRET;
  const okPassword = passwordMatches(password);
  const okCode =
    !secret || verifyTotp(secret, String(formData.get("code") ?? ""));
  if (!okPassword || !okCode) {
    return {
      error: secret
        ? "비밀번호 또는 인증 코드가 올바르지 않습니다."
        : "비밀번호가 올바르지 않습니다.",
    };
  }
  await createAdminSession();
  redirect("/admin");
}

export async function logout() {
  await deleteSession();
  redirect("/");
}
