import "server-only";
import { prisma } from "@/lib/prisma";
import { ADMIN_PAGE_SIZE } from "@/lib/feeds";
import { getAdminNickname } from "@/lib/comment-actor";
import { hashPassword, verifyPassword } from "@/lib/password";

export type UserStatus = "pending" | "approved" | "rejected";
export type UserRole = "member" | "admin";

type Result<T = undefined> =
  | { ok: true; value?: T }
  | { ok: false; error: string };

export const NICKNAME_TAKEN_MESSAGE = "이미 사용 중인 닉네임입니다.";

// 닉네임 중복(다른 회원 + 예약 관리자 닉네임, 행 미존재 시 기본값 포함). exceptUserId는 본인 제외.
export async function isNicknameTaken(
  nickname: string,
  exceptUserId?: string,
): Promise<boolean> {
  const trimmed = nickname.trim();
  // 관리자 닉네임 선점 방지(관리자 User 행이 없을 때의 기본값까지 차단).
  if (trimmed === (await getAdminNickname()).trim()) return true;
  const found = await prisma.user.findFirst({
    where: {
      nickname: trimmed,
      ...(exceptUserId ? { id: { not: exceptUserId } } : {}),
    },
    select: { id: true },
  });
  return found !== null;
}

export async function createPendingUser(input: {
  email: string;
  nickname: string;
  password: string;
}): Promise<Result> {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, status: true },
  });
  if (existing) {
    if (existing.status === "pending")
      return {
        ok: false,
        error: "이미 회원가입 신청 중입니다. 관리자 승인을 기다려 주세요.",
      };
    if (existing.status === "approved")
      return { ok: false, error: "이미 가입된 이메일입니다." };
    if (await isNicknameTaken(input.nickname, existing.id))
      return { ok: false, error: NICKNAME_TAKEN_MESSAGE };
    // rejected → 재신청: 같은 행을 pending으로 되돌리고 새 입력값으로 갱신.
    // 이전 rejectionReason/rejectedAt는 보존(관리자가 과거 거절 사유 참고).
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        nickname: input.nickname.trim(),
        passwordHash: await hashPassword(input.password),
        status: "pending",
      },
    });
    return { ok: true };
  }
  if (await isNicknameTaken(input.nickname))
    return { ok: false, error: NICKNAME_TAKEN_MESSAGE };
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

// 회원 본인 닉네임 변경. 변경된 닉네임 반환(세션 갱신용).
export async function updateNickname(
  id: string,
  nickname: string,
): Promise<string> {
  const trimmed = nickname.trim();
  await prisma.user.update({ where: { id }, data: { nickname: trimmed } });
  return trimmed;
}

export async function approveUser(id: string) {
  // 승인 시 과거 거절 이력 정리.
  await prisma.user.update({
    where: { id },
    data: { status: "approved", rejectionReason: null, rejectedAt: null },
  });
}

// 거절: 행을 삭제하지 않고 status=rejected로 두고 사유를 기록.
// 같은 이메일로 재신청하면 createPendingUser가 이 행을 pending으로 되돌린다.
export async function rejectUser(id: string, reason: string) {
  await prisma.user.update({
    where: { id },
    data: {
      status: "rejected",
      rejectionReason: reason.trim() || null,
      rejectedAt: new Date(),
    },
  });
}

export async function deleteUser(id: string) {
  await prisma.user.delete({ where: { id } });
}

// role: "member"로 예약 admin 작성자(role admin)를 회원 목록/카운트에서 제외.
// rejectionReason: 재신청(rejected→pending)한 신청의 과거 거절 사유를 대기 목록에 표시.
export async function listUsersByStatus(status: UserStatus) {
  return prisma.user.findMany({
    where: { status, role: "member" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      nickname: true,
      createdAt: true,
      rejectionReason: true,
    },
  });
}

// 관리자 대시보드용 카운트.
export async function countUsersByStatus(status: UserStatus) {
  return prisma.user.count({ where: { status, role: "member" } });
}

// 관리자용: 상태별 페이지 단위(기본 20). 목록 + 전체 개수 반환.
export async function listUsersPage(
  status: UserStatus,
  page: number,
  pageSize = ADMIN_PAGE_SIZE,
) {
  const take = pageSize;
  const skip = (Math.max(1, page) - 1) * take;
  const where = { status, role: "member" as const };
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, nickname: true, createdAt: true },
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total, pageSize: take };
}
