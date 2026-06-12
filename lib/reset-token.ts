import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

// 비밀번호 재설정 플로우 단계 인증용 서명 쿠키(세션과 분리).
const COOKIE = "pwreset";
const MAX_AGE_S = 15 * 60; // 검증 후 새 비번 입력까지의 여유
const key = () => new TextEncoder().encode(process.env.SESSION_SECRET);

export type ResetCookie = {
  email: string;
  expiresAt: string; // 코드 만료(타이머 표시용), ISO
  verified: boolean; // 코드 검증 완료 여부
};

export async function setResetCookie(data: ResetCookie) {
  const token = await new SignJWT(data)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(key());
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function getResetCookie(): Promise<ResetCookie | undefined> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return undefined;
  try {
    const { payload } = await jwtVerify(token, key(), {
      algorithms: ["HS256"],
    });
    return payload as unknown as ResetCookie;
  } catch {
    return undefined;
  }
}

export async function clearResetCookie() {
  (await cookies()).delete(COOKIE);
}
