import "server-only";
import { cookies } from "next/headers";
import { encrypt } from "@/lib/jwt";

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function createSession() {
  const expiresAt = new Date(Date.now() + MAX_AGE_MS);
  const token = await encrypt({ admin: true, expiresAt: expiresAt.toISOString() });
  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}
