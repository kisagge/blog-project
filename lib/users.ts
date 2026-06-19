import "server-only";
import { prisma } from "@/lib/prisma";
import { ADMIN_PAGE_SIZE } from "@/lib/feeds";
import { getAdminNickname } from "@/lib/comment-actor";
import { hashPassword, verifyPassword } from "@/lib/password";
import type { Result } from "@/lib/result";

export type UserStatus = "pending" | "approved" | "rejected" | "blocked";
export type UserRole = "member" | "admin";

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

export type MemberProfile = {
  id: string;
  nickname: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  status: UserStatus;
};

// 공개 프로필용 단건. 회원(role:"member")만 — 예약 admin/없는 id는 null(→ 라우트 404).
export async function getMemberProfile(
  id: string,
): Promise<MemberProfile | null> {
  const u = await prisma.user.findFirst({
    where: { id, role: "member" },
    select: {
      id: true,
      nickname: true,
      bio: true,
      avatarUrl: true,
      createdAt: true,
      status: true,
    },
  });
  return u ? { ...u, status: u.status as UserStatus } : null;
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
  if (user.status === "blocked")
    return { ok: false, error: "이용이 제한된 계정입니다." };
  if (user.status !== "approved")
    return { ok: false, error: "관리자 승인 대기 중입니다." };
  return { ok: true, user: { id: user.id, nickname: user.nickname } };
}

// 회원 본인 프로필(닉네임·자기소개·아바타) 변경. bio·avatarUrl은 빈 문자열이면 null(미설정·제거).
// nickname(세션 갱신용)과 교체로 버려진 이전 아바타 URL(파일 정리용, 변경 없으면 null)을 반환.
export async function updateProfile(
  id: string,
  input: { nickname: string; bio: string; avatarUrl: string },
): Promise<{ nickname: string; replacedAvatarUrl: string | null }> {
  const nickname = input.nickname.trim();
  const bio = input.bio.trim();
  const avatarUrl = input.avatarUrl.trim() || null;
  const before = await prisma.user.findUnique({
    where: { id },
    select: { avatarUrl: true },
  });
  await prisma.user.update({
    where: { id },
    data: { nickname, bio: bio || null, avatarUrl },
  });
  const old = before?.avatarUrl ?? null;
  const replacedAvatarUrl = old && old !== avatarUrl ? old : null;
  return { nickname, replacedAvatarUrl };
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

// 차단: 영구 삭제 대신 status=blocked로 두어 로그인·활동을 막는다(되돌리기 가능, 콘텐츠 보존).
export async function blockUser(id: string) {
  await prisma.user.update({ where: { id }, data: { status: "blocked" } });
}

// 차단 해제: 다시 approved로 복구.
export async function unblockUser(id: string) {
  await prisma.user.update({ where: { id }, data: { status: "approved" } });
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
export async function countUsersByStatus(status: UserStatus | UserStatus[]) {
  return prisma.user.count({
    where: {
      status: Array.isArray(status) ? { in: status } : status,
      role: "member",
    },
  });
}

// 관리자용: 상태별 페이지 단위(기본 20). 목록 + 전체 개수 반환.
export async function listUsersPage(
  status: UserStatus | UserStatus[],
  page: number,
  pageSize = ADMIN_PAGE_SIZE,
) {
  const take = pageSize;
  const skip = (Math.max(1, page) - 1) * take;
  const where = {
    status: Array.isArray(status) ? { in: status } : status,
    role: "member" as const,
  };
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        nickname: true,
        status: true,
        createdAt: true,
      },
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total, pageSize: take };
}
