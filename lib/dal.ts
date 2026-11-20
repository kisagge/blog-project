import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decrypt } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import type { ViewerRole } from "@/lib/visibility";

// 토큰 + (회원이면) DB 상태를 요청당 1회 확인. JWT만 믿으면 차단·비번 재설정 후에도
// 남은 토큰으로 최대 7일 회원 글을 볼 수 있었다 → 회원 행이 없거나 세션 버전이 다르면 세션 무효.
const verifiedSession = cache(async () => {
  const token = (await cookies()).get("session")?.value;
  const s = await decrypt(token);
  if (s?.role !== "member") return { session: s, status: null };
  const u = await prisma.user.findUnique({
    where: { id: s.userId },
    select: { sessionVersion: true, status: true },
  });
  if (!u || u.sessionVersion !== (s.sv ?? 0))
    return { session: undefined, status: null };
  return { session: s, status: u.status };
});

// 세션이 있으면 payload, 없으면 undefined (redirect 안 함). 무효화된 회원 세션은 undefined.
export const getSession = cache(async () => (await verifiedSession()).session);

// 공개 범위 판정용 뷰어 권한. 승인 상태가 아닌 회원(차단 등)은 비로그인과 같다.
export const getViewerRole = cache(async (): Promise<ViewerRole> => {
  const { session, status } = await verifiedSession();
  if (session?.role === "admin") return "admin";
  return session?.role === "member" && status === "approved"
    ? "member"
    : "anon";
});

// 관리자 전용 가드: 관리자 세션이 아니면(비로그인·회원 모두) /login으로 redirect
export const verifySession = cache(async () => {
  const session = await getSession();
  if (session?.role !== "admin") redirect("/login");
  return session;
});

// 회원 세션이고 현재도 승인(approved) 상태면 그대로, 아니면 null.
// 차단(blocked)된 회원은 기존 세션이 남아 있어도 즉시 활동 불가. 회원 전용 액션 가드 공용.
export const getMemberSession = cache(async () => {
  const { session, status } = await verifiedSession();
  return session?.role === "member" && status === "approved" ? session : null;
});

// 회원 세션 쿠키는 있으나 현재 승인 상태가 아닌(=차단된) 회원인지. 공유 버튼 숨김 등에 사용.
export const isBlockedMember = cache(async () => {
  const { session, status } = await verifiedSession();
  return session?.role === "member" && status !== "approved";
});
