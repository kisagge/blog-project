"use server";
import { redirect } from "next/navigation";
import {
  ResetEmailSchema,
  ResetCodeSchema,
  ResetPasswordSchema,
} from "@/lib/validation";
import {
  requestPasswordReset,
  verifyResetCode,
  resetPassword,
} from "@/lib/password-reset";
import {
  setResetCookie,
  getResetCookie,
  clearResetCookie,
} from "@/lib/reset-token";

export type RequestState = { error?: string } | undefined;
export type VerifyState = { error?: string } | undefined;
export type ResetState =
  | { errors?: Record<string, string[]>; error?: string }
  | undefined;

// 1단계: 이메일 입력 → 코드 발송(존재 비노출) → 검증 페이지로.
export async function requestCode(
  _state: RequestState,
  formData: FormData,
): Promise<RequestState> {
  const parsed = ResetEmailSchema.safeParse({
    email: String(formData.get("email") ?? ""),
  });
  if (!parsed.success) return { error: "올바른 이메일을 입력하세요." };
  const { expiresAt } = await requestPasswordReset(parsed.data.email);
  await setResetCookie({
    email: parsed.data.email,
    expiresAt: expiresAt.toISOString(),
    verified: false,
  });
  redirect("/forgot-password/verify");
}

// 재전송: 쿠키의 이메일로 코드 재발급 + 타이머 갱신.
export async function resendCode() {
  const cookie = await getResetCookie();
  if (!cookie) redirect("/forgot-password");
  const { expiresAt } = await requestPasswordReset(cookie.email);
  await setResetCookie({
    email: cookie.email,
    expiresAt: expiresAt.toISOString(),
    verified: false,
  });
  redirect("/forgot-password/verify");
}

// 2단계: 6자리 코드 검증 → 통과 시 새 비번 페이지로.
export async function verifyCode(
  _state: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const cookie = await getResetCookie();
  if (!cookie) redirect("/forgot-password");
  const parsed = ResetCodeSchema.safeParse({
    code: String(formData.get("code") ?? ""),
  });
  if (!parsed.success) return { error: "6자리 숫자 코드를 입력하세요." };
  const res = await verifyResetCode(cookie.email, parsed.data.code);
  if (!res.ok) return { error: res.error };
  await setResetCookie({ ...cookie, verified: true });
  redirect("/forgot-password/reset");
}

// 3단계: 새 비밀번호 저장 → 로그인 페이지로.
export async function submitNewPassword(
  _state: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const cookie = await getResetCookie();
  if (!cookie || !cookie.verified) redirect("/forgot-password");
  const parsed = ResetPasswordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const res = await resetPassword(cookie.email, parsed.data.password);
  if (!res.ok) return { error: res.error };
  await clearResetCookie();
  redirect("/signin?reset=1");
}
