import { SignJWT, jwtVerify } from "jose";

export type SessionPayload =
  | { role: "admin"; expiresAt: string }
  | { role: "member"; userId: string; nickname: string; expiresAt: string };

const encodedKey = () => new TextEncoder().encode(process.env.SESSION_SECRET);

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey());
}

export async function decrypt(
  token?: string,
): Promise<SessionPayload | undefined> {
  if (!token) return undefined;
  try {
    const { payload } = await jwtVerify(token, encodedKey(), {
      algorithms: ["HS256"],
    });
    return payload as SessionPayload;
  } catch {
    return undefined;
  }
}
