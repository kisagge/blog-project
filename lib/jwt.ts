import { SignJWT, jwtVerify } from "jose";

export type SessionPayload =
  | { role: "admin"; expiresAt: string }
  | {
      role: "member";
      userId: string;
      nickname: string;
      // 세션 버전(User.sessionVersion). 없으면(도입 전 토큰) 0으로 간주.
      sv?: number;
      expiresAt: string;
    };

// 로그인 세션 쿠키(이름·수명). 발급(lib/session)·읽기(lib/dal, proxy)가 같은 값을 쓴다.
export const SESSION_COOKIE = "session";
export const SESSION_TTL_S = 7 * 24 * 60 * 60; // 7일

const encodedKey = () => new TextEncoder().encode(process.env.SESSION_SECRET);

// SESSION_SECRET으로 서명한 HS256 JWT(세션·비밀번호 재설정 단계 쿠키 공용).
export async function signJwt(
  payload: Record<string, unknown>,
  ttlSeconds: number,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(encodedKey());
}

// 서명·만료가 유효하면 페이로드, 아니면(없음·위조·만료) undefined.
export async function verifyJwt<T>(token?: string): Promise<T | undefined> {
  if (!token) return undefined;
  try {
    const { payload } = await jwtVerify(token, encodedKey(), {
      algorithms: ["HS256"],
    });
    return payload as T;
  } catch {
    return undefined;
  }
}

export function encrypt(payload: SessionPayload): Promise<string> {
  return signJwt(payload, SESSION_TTL_S);
}

export function decrypt(token?: string): Promise<SessionPayload | undefined> {
  return verifyJwt<SessionPayload>(token);
}
