import "server-only";
import { cookies } from "next/headers";
import {
  encrypt,
  SESSION_COOKIE,
  SESSION_TTL_S,
  type SessionPayload,
} from "@/lib/jwt";
import { baseCookieOptions } from "@/lib/cookie-options";

// 유니온 멤버별로 분배되는 Omit (기본 Omit은 공통 키만 남겨 member 필드를 잃는다)
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

async function setSessionCookie(
  payload: DistributiveOmit<SessionPayload, "expiresAt">,
) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_S * 1000);
  const token = await encrypt({
    ...payload,
    expiresAt: expiresAt.toISOString(),
  } as SessionPayload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    ...baseCookieOptions(),
    expires: expiresAt,
  });
}

export async function createAdminSession() {
  await setSessionCookie({ role: "admin" });
}

// sv: 발급 시점의 User.sessionVersion — 이후 비번 재설정·차단으로 버전이 오르면 이 토큰은 무효.
export async function createMemberSession(
  userId: string,
  nickname: string,
  sv: number,
) {
  await setSessionCookie({ role: "member", userId, nickname, sv });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
