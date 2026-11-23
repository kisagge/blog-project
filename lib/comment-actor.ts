import "server-only";
import { getSession, getMemberSession } from "@/lib/dal";
import { ensureAdminUser } from "@/lib/admin-user";

export type CommentActor = {
  userId: string;
  nickname: string;
  role: "member" | "admin";
};

// 현재 세션의 작성 주체(member|admin). anon·차단된 회원이면 null.
export async function getCommentActor(): Promise<CommentActor | null> {
  // 차단 회원 즉시 배제(getMemberSession이 approved 상태를 확인).
  const member = await getMemberSession();
  if (member)
    return {
      userId: member.userId,
      nickname: member.nickname,
      role: "member",
    };
  const session = await getSession();
  if (session?.role === "admin") {
    const admin = await ensureAdminUser();
    return { userId: admin.id, nickname: admin.nickname, role: "admin" };
  }
  return null;
}
