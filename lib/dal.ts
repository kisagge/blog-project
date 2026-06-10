import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decrypt } from "@/lib/jwt";

// 세션이 있으면 payload, 없으면 undefined (redirect 안 함)
export const getSession = cache(async () => {
  const token = (await cookies()).get("session")?.value;
  return decrypt(token);
});

// 보호용: 세션 없으면 /login로 redirect
export const verifySession = cache(async () => {
  const session = await getSession();
  if (session?.role !== "admin") redirect("/login");
  return session;
});
