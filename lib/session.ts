import "server-only";
import { cookies } from "next/headers";
import { encrypt, type SessionPayload } from "@/lib/jwt";

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// 유니온 멤버별로 분배되는 Omit (기본 Omit은 공통 키만 남겨 member 필드를 잃는다)
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

async function setSessionCookie(
  payload: DistributiveOmit<SessionPayload, "expiresAt">,
) {
  const expiresAt = new Date(Date.now() + MAX_AGE_MS);
  const token = await encrypt({
    ...payload,
    expiresAt: expiresAt.toISOString(),
  } as SessionPayload);
  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function createAdminSession() {
  await setSessionCookie({ role: "admin" });
}

export async function createMemberSession(userId: string, nickname: string) {
  await setSessionCookie({ role: "member", userId, nickname });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}
