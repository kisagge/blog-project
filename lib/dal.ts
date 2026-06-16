import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decrypt } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
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

// 회원 세션이고 현재도 승인(approved) 상태면 그대로, 아니면 null.
// 차단(blocked)된 회원은 기존 세션이 남아 있어도 즉시 활동 불가. 회원 전용 액션 가드 공용.
export const getMemberSession = cache(async () => {
  const s = await getSession();
  if (s?.role !== "member") return null;
  const u = await prisma.user.findUnique({
    where: { id: s.userId },
    select: { status: true },
  });
  return u?.status === "approved" ? s : null;
});

// 회원 세션 쿠키는 있으나 현재 승인 상태가 아닌(=차단된) 회원인지. 공유 버튼 숨김 등에 사용.
export const isBlockedMember = cache(async () => {
  const s = await getSession();
  if (s?.role !== "member") return false;
  return (await getMemberSession()) === null;
});
