import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decrypt } from "@/lib/jwt";
import type { ViewerRole } from "@/lib/visibility";

// 세션이 있으면 payload, 없으면 undefined (redirect 안 함)
export const getSession = cache(async () => {
  const token = (await cookies()).get("session")?.value;
  return decrypt(token);
});

// 공개 범위 판정용 뷰어 권한.
export const getViewerRole = cache(async (): Promise<ViewerRole> => {
  const s = await getSession();
  return s?.role === "admin"
    ? "admin"
    : s?.role === "member"
      ? "member"
      : "anon";
});

// 보호용: 세션 없으면 /login로 redirect
export const verifySession = cache(async () => {
  const session = await getSession();
  if (session?.role !== "admin") redirect("/login");
  return session;
});
