import "server-only";
import { prisma } from "@/lib/prisma";

// 관리자 작성·알림용 예약 User(싱글톤). 관리자는 env 비밀번호로 로그인하고 DB 행이 따로 없으므로,
// 관리자가 쓴 댓글·받는 알림이 가리킬 User 행을 이메일 고정으로 하나 둔다. 로그인 불가 해시("-").
export const ADMIN_EMAIL = "admin@byjang.local";
// 예약 도메인 — 회원 가입에서 거부(예약 계정을 먼저 선점해 관리자 신원을 가로채지 못하게).
export const RESERVED_EMAIL_DOMAIN = "@byjang.local";
const ADMIN_DEFAULT_NICKNAME = "관리자";

// 시스템 계정 고정 속성. 로그인 불가 해시("-" — salt:hash 형식이 아니라 어떤 비밀번호로도 불일치).
const SYSTEM_ACCOUNT = {
  passwordHash: "-",
  role: "admin",
  status: "approved",
} as const;

const adminCreate = (nickname = ADMIN_DEFAULT_NICKNAME) => ({
  email: ADMIN_EMAIL,
  nickname,
  ...SYSTEM_ACCOUNT,
});

// 없으면 만들고(멱등) 행을 돌려준다. 이미 같은 이메일 행이 있으면 시스템 계정 속성으로 덮어써
// 누군가 그 이메일을 먼저 차지했더라도 그 비밀번호로는 로그인할 수 없게 한다(가입 차단과 이중 방어).
export async function ensureAdminUser() {
  return prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: SYSTEM_ACCOUNT,
    create: adminCreate(),
  });
}

// 이미 있을 때만 id(없으면 null — 조회만, 만들지 않음).
export async function findAdminUserId(): Promise<string | null> {
  const u = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true },
  });
  return u?.id ?? null;
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
    create: adminCreate(name),
  });
}
