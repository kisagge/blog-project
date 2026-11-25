import "server-only";
import { uploadNameFromUrl } from "@/lib/save-image";
import { prisma } from "@/lib/prisma";
import { ADMIN_PAGE_SIZE, pageWindow } from "@/lib/pagination";
import { getAdminNickname, RESERVED_EMAIL_DOMAIN } from "@/lib/admin-user";
import { hashPassword, verifyPassword } from "@/lib/password";
import type { Result } from "@/lib/result";
import { normalizeEmail } from "@/lib/email";
import { isEmailBlocked } from "@/lib/blocked-email";
import { WITHDRAWN_NICKNAME } from "@/lib/withdrawal";

export type UserStatus = "pending" | "approved" | "rejected" | "blocked";

export const NICKNAME_TAKEN_MESSAGE = "이미 사용 중인 닉네임입니다.";

// 닉네임 중복(다른 회원 + 예약 관리자 닉네임, 행 미존재 시 기본값 포함). exceptUserId는 본인 제외.
export async function isNicknameTaken(
  nickname: string,
  exceptUserId?: string,
): Promise<boolean> {
  const trimmed = nickname.trim();
  // 관리자 닉네임·"탈퇴한 회원" 선점 방지(사칭). 관리자 행이 없을 때의 기본 닉네임까지 차단.
  if (trimmed === WITHDRAWN_NICKNAME) return true;
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

export const RESERVED_EMAIL_MESSAGE = "사용할 수 없는 이메일입니다.";

export const BLOCKED_SIGNUP_MESSAGE =
  "이 이메일로는 가입할 수 없습니다. 관리자에게 문의해 주세요.";

export async function createPendingUser(input: {
  email: string;
  nickname: string;
  password: string;
}): Promise<Result> {
  const email = normalizeEmail(input.email);
  // 관리자 예약 계정 도메인은 가입 불가(예약 계정 선점 방지).
  if (email.endsWith(RESERVED_EMAIL_DOMAIN))
    return { ok: false, error: RESERVED_EMAIL_MESSAGE };
  // 차단 상태로 탈퇴한 회원의 이메일(해시)은 재가입 불가 — 탈퇴로 차단을 피하지 못하게.
  if (await isEmailBlocked(email))
    return { ok: false, error: BLOCKED_SIGNUP_MESSAGE };
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
    // 차단 회원이 재신청으로 pending에 복귀(차단 해제)하거나, 이메일만 아는 제3자가
    // 비밀번호를 덮어쓰지 못하게 거부. 재신청은 거절(rejected)된 경우에만 허용.
    if (existing.status === "blocked")
      return { ok: false, error: BLOCKED_SIGNUP_MESSAGE };
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
    where: { email: normalizeEmail(email) },
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

export type AuthedMember = {
  id: string;
  nickname: string;
  sessionVersion: number;
};

// 거절된 신청의 로그인 안내. 거절 사유는 관리자 참고용이라 신청자에게 보이지 않는다(스키마 주석 정책).
// 같은 이메일 재신청은 허용(createPendingUser) — 다시 신청할 수 있음을 알려 막다른 길을 없앤다.
export const REJECTED_SIGNIN_MESSAGE =
  "가입 신청이 승인되지 않았습니다. 같은 이메일로 다시 신청할 수 있습니다.";

export async function authenticateMember(
  email: string,
  password: string,
): Promise<{ ok: true; user: AuthedMember } | { ok: false; error: string }> {
  const user = await findUserByEmail(email);
  const generic = "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (!user) return { ok: false, error: generic };
  if (!(await verifyPassword(password, user.passwordHash)))
    return { ok: false, error: generic };
  // 회원 로그인은 회원 행만(예약 관리자 등 다른 역할은 존재를 드러내지 않고 일반 오류).
  if (user.role !== "member") return { ok: false, error: generic };
  if (user.status === "blocked")
    return { ok: false, error: "이용이 제한된 계정입니다." };
  if (user.status === "rejected")
    return { ok: false, error: REJECTED_SIGNIN_MESSAGE };
  if (user.status !== "approved")
    return { ok: false, error: "관리자 승인 대기 중입니다." };
  return {
    ok: true,
    user: {
      id: user.id,
      nickname: user.nickname,
      sessionVersion: user.sessionVersion,
    },
  };
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
  // 같은 파일을 쿼리(?w=&h=)만 달리해 다시 저장한 경우는 교체가 아님 — 쓰는 중인 파일을 지우지 않게 파일명으로 비교.
  const replacedAvatarUrl =
    old && uploadNameFromUrl(old) !== uploadNameFromUrl(avatarUrl ?? "")
      ? old
      : null;
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
// 세션 버전을 올려 이미 로그인된 기기도 즉시 로그아웃(해제 후엔 다시 로그인해야 함).
export async function blockUser(id: string) {
  await prisma.user.update({
    where: { id },
    data: { status: "blocked", sessionVersion: { increment: 1 } },
  });
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
  const { skip, take } = pageWindow(page, pageSize);
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

// 로그인한 회원 본인의 비밀번호 재확인(탈퇴 등 되돌릴 수 없는 작업 전).
export async function verifyMemberPassword(
  userId: string,
  password: string,
): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, role: true },
  });
  if (!u || u.role !== "member") return false;
  return verifyPassword(password, u.passwordHash);
}
