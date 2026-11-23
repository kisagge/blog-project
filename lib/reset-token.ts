import "server-only";
import { cookies } from "next/headers";
import { signJwt, verifyJwt } from "@/lib/jwt";
import { baseCookieOptions } from "@/lib/cookie-options";
import { RESET_VERIFY_GRACE_MS } from "@/lib/reset-policy";

// 비밀번호 재설정 플로우 단계 인증용 서명 쿠키(세션과 분리).
const COOKIE = "pwreset";
const MAX_AGE_S = RESET_VERIFY_GRACE_MS / 1000; // 검증 후 새 비번 입력까지의 여유

export type ResetCookie = {
  email: string;
  expiresAt: string; // 코드 만료(타이머 표시용), ISO
  verified: boolean; // 코드 검증 완료 여부
};

export async function setResetCookie(data: ResetCookie) {
  const token = await signJwt(data, MAX_AGE_S);
  const store = await cookies();
  store.set(COOKIE, token, { ...baseCookieOptions(), maxAge: MAX_AGE_S });
}

export async function getResetCookie(): Promise<ResetCookie | undefined> {
  return verifyJwt<ResetCookie>((await cookies()).get(COOKIE)?.value);
}

export async function clearResetCookie() {
  (await cookies()).delete(COOKIE);
}
