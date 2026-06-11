import { prisma } from "@/lib/prisma";
import { ADMIN_PAGE_SIZE } from "@/lib/feeds";
import { hashPassword, verifyPassword } from "@/lib/password";
import { ADMIN_EMAIL } from "@/lib/comment-actor";

type Result<T = undefined> =
  | { ok: true; value?: T }
  | { ok: false; error: string };

export async function createPendingUser(input: {
  email: string;
  nickname: string;
  password: string;
}): Promise<Result> {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) return { ok: false, error: "이미 가입된 이메일입니다." };
  await prisma.user.create({
    data: {
      email,
      nickname: input.nickname.trim(),
      passwordHash: await hashPassword(input.password),
    },
  });
  return { ok: true };
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
}

export type AuthedMember = { id: string; nickname: string };

export async function authenticateMember(
  email: string,
  password: string,
): Promise<{ ok: true; user: AuthedMember } | { ok: false; error: string }> {
  const user = await findUserByEmail(email);
  const generic = "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (!user) return { ok: false, error: generic };
  if (!(await verifyPassword(password, user.passwordHash)))
    return { ok: false, error: generic };
  if (user.status !== "approved")
    return { ok: false, error: "관리자 승인 대기 중입니다." };
  return { ok: true, user: { id: user.id, nickname: user.nickname } };
}

export async function approveUser(id: string) {
  await prisma.user.update({ where: { id }, data: { status: "approved" } });
}

export async function deleteUser(id: string) {
  await prisma.user.delete({ where: { id } });
}

export async function listUsersByStatus(status: "pending" | "approved") {
  return prisma.user.findMany({
    where: { status, email: { not: ADMIN_EMAIL } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, nickname: true, createdAt: true },
  });
}

// 관리자 대시보드용 카운트.
export async function countUsersByStatus(status: "pending" | "approved") {
  return prisma.user.count({ where: { status, email: { not: ADMIN_EMAIL } } });
}

// 관리자용: 상태별 페이지 단위(기본 20). 목록 + 전체 개수 반환.
export async function listUsersPage(
  status: "pending" | "approved",
  page: number,
  pageSize = ADMIN_PAGE_SIZE,
) {
  const take = pageSize;
  const skip = (Math.max(1, page) - 1) * take;
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, nickname: true, createdAt: true },
      skip,
      take,
    }),
    prisma.user.count({ where: { status } }),
  ]);
  return { items, total, pageSize: take };
}
