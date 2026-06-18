"use server";
import { redirect } from "next/navigation";
import { verifyTurnstile } from "@/lib/turnstile";
import { getClientIp } from "@/lib/client-ip";
import { allowAction, TOO_MANY_REQUESTS } from "@/lib/rate-limit";
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
import type { FormState, SimpleFormState } from "@/lib/form-state";

export type RequestState = SimpleFormState;
export type VerifyState = SimpleFormState;
export type ResetState = FormState;

// 1단계: 이메일 입력 → 코드 발송(존재 비노출) → 검증 페이지로.
export async function requestCode(
  _state: RequestState,
  formData: FormData,
): Promise<RequestState> {
  const ip = (await getClientIp()) ?? "unknown";
  // 코드 요청 남발 방지(IP당). 한 IP가 여러 이메일을 두드리는 것을 차단(이메일당 60s 쿨다운은 별개).
  if (!allowAction("passwordReset", ip)) return { error: TOO_MANY_REQUESTS };
  if (
    !(await verifyTurnstile(
      String(formData.get("cf-turnstile-response") ?? ""),
      ip,
    ))
  )
    return { error: "사람 확인에 실패했습니다. 다시 시도해 주세요." };

  const parsed = ResetEmailSchema.safeParse({
    email: String(formData.get("email") ?? ""),
  });
  if (!parsed.success) return { error: "올바른 이메일을 입력하세요." };
  // 백엔드 오류(DB 락 등)가 화면을 깨지 않도록 흡수 — redirect는 try 밖(NEXT_REDIRECT 보존).
  try {
    const { expiresAt } = await requestPasswordReset(parsed.data.email);
    await setResetCookie({
      email: parsed.data.email,
      expiresAt: expiresAt.toISOString(),
      verified: false,
    });
  } catch (e) {
    console.error("[forgot-password] requestCode 실패:", e);
    return { error: "코드 전송 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요." };
  }
  redirect("/forgot-password/verify");
}

// 재전송: 쿠키의 이메일로 코드 재발급 + 타이머 갱신.
export async function resendCode() {
  const cookie = await getResetCookie();
  if (!cookie) redirect("/forgot-password");
  try {
    const { expiresAt } = await requestPasswordReset(cookie.email);
    await setResetCookie({
      email: cookie.email,
      expiresAt: expiresAt.toISOString(),
      verified: false,
    });
  } catch (e) {
    console.error("[forgot-password] resendCode 실패:", e); // 삼키고 타이머 화면 유지
  }
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
  try {
    const res = await verifyResetCode(cookie.email, parsed.data.code);
    if (!res.ok) return { error: res.error };
    await setResetCookie({ ...cookie, verified: true });
  } catch (e) {
    console.error("[forgot-password] verifyCode 실패:", e);
    return { error: "처리 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요." };
  }
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
  try {
    const res = await resetPassword(cookie.email, parsed.data.password);
    if (!res.ok) return { error: res.error };
    await clearResetCookie();
  } catch (e) {
    console.error("[forgot-password] submitNewPassword 실패:", e);
    return { error: "처리 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요." };
  }
  redirect("/signin?reset=1");
}
