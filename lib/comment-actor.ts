import "server-only";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/dal";

export const ADMIN_EMAIL = "admin@byjang.local";
const ADMIN_DEFAULT_NICKNAME = "관리자";

// 관리자 작성용 예약 User(싱글톤). 로그인 불가 해시("-": salt:hash 형식 아님).
export async function ensureAdminUser() {
  return prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      nickname: ADMIN_DEFAULT_NICKNAME,
      passwordHash: "-",
      status: "approved",
    },
  });
}

export async function getAdminNickname() {
  const u = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { nickname: true },
  });
  return u?.nickname ?? ADMIN_DEFAULT_NICKNAME;
}

export async function setAdminNickname(nickname: string) {
  const name = nickname.trim() || ADMIN_DEFAULT_NICKNAME;
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { nickname: name },
    create: {
      email: ADMIN_EMAIL,
      nickname: name,
      passwordHash: "-",
      status: "approved",
    },
  });
}

export type CommentActor = { userId: string; nickname: string };

// 현재 세션의 작성 주체(member|admin). anon이면 null.
export async function getCommentActor(): Promise<CommentActor | null> {
  const session = await getSession();
  if (session?.role === "member")
    return { userId: session.userId, nickname: session.nickname };
  if (session?.role === "admin") {
    const admin = await ensureAdminUser();
    return { userId: admin.id, nickname: admin.nickname };
  }
  return null;
}
