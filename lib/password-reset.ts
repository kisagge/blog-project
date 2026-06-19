import "server-only";
import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { sendPasswordResetCode } from "@/lib/mailer";
import type { Result } from "@/lib/result";

const CODE_TTL_MS = 3 * 60 * 1000; // 코드 유효시간 3분
const MAX_ATTEMPTS = 5; // 검증 시도 제한
const VERIFY_GRACE_MS = 15 * 60 * 1000; // 검증 후 새 비번 입력 허용 시간
const RESEND_COOLDOWN_MS = 60 * 1000; // 같은 이메일 재발송 최소 간격(메일 폭탄 방지)

function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// 코드 요청. 이메일 존재 여부는 노출하지 않는다(항상 expiresAt 반환).
// 실제 발송/저장은 승인된 회원에게만.
export async function requestPasswordReset(
  email: string,
): Promise<{ expiresAt: Date }> {
  const normalized = email.trim().toLowerCase();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { role: true, status: true },
  });
  if (user && user.role === "member" && user.status === "approved") {
    // 재발송 쿨다운: 최근 미사용 코드가 쿨다운 내면 새 코드·메일을 보내지 않음
    // (재전송 난타로 인한 메일 폭탄 방지). 기존 만료시각을 그대로 반환해 타이머 유지.
    const recent = await prisma.passwordResetCode.findFirst({
      where: { email: normalized, consumedAt: null },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, expiresAt: true },
    });
    if (
      recent &&
      Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS
    ) {
      return { expiresAt: recent.expiresAt };
    }
    const code = generateCode();
    // 이메일별 미사용 코드는 폐기하고 새로 발급(최신 1건만 유효).
    await prisma.passwordResetCode.deleteMany({
      where: { email: normalized, consumedAt: null },
    });
    await prisma.passwordResetCode.create({
      data: {
        email: normalized,
        codeHash: await hashPassword(code),
        expiresAt,
      },
    });
    // 발송 실패(SES 샌드박스·바운스·스로틀 등)가 플로우를 깨뜨리지 않도록 흡수.
    // 존재 비노출 정책상 UX는 성공/실패와 무관하게 동일해야 한다.
    try {
      await sendPasswordResetCode(normalized, code);
    } catch (e) {
      console.error("[password-reset] 코드 메일 발송 실패:", e);
    }
  }
  return { expiresAt };
}

export async function verifyResetCode(
  email: string,
  code: string,
): Promise<Result> {
  const normalized = email.trim().toLowerCase();
  const rec = await prisma.passwordResetCode.findFirst({
    where: { email: normalized, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!rec) return { ok: false, error: "코드를 먼저 요청해 주세요." };
  if (rec.expiresAt < new Date())
    return { ok: false, error: "코드가 만료되었습니다. 재전송해 주세요." };
  if (rec.attempts >= MAX_ATTEMPTS)
    return { ok: false, error: "시도 횟수를 초과했습니다. 재전송해 주세요." };
  if (!(await verifyPassword(code, rec.codeHash))) {
    await prisma.passwordResetCode.update({
      where: { id: rec.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, error: "코드가 일치하지 않습니다." };
  }
  await prisma.passwordResetCode.update({
    where: { id: rec.id },
    data: { verifiedAt: new Date() },
  });
  return { ok: true };
}

// 검증된 코드가 있을 때만 비밀번호 변경. 변경 후 코드를 소비 처리.
export async function resetPassword(
  email: string,
  newPassword: string,
): Promise<Result> {
  const normalized = email.trim().toLowerCase();
  const rec = await prisma.passwordResetCode.findFirst({
    where: { email: normalized, consumedAt: null, verifiedAt: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  if (!rec)
    return { ok: false, error: "인증이 필요합니다. 다시 시도해 주세요." };
  if (Date.now() - rec.verifiedAt!.getTime() > VERIFY_GRACE_MS)
    return { ok: false, error: "시간이 만료되었습니다. 다시 시도해 주세요." };
  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true },
  });
  if (!user) return { ok: false, error: "계정을 찾을 수 없습니다." };
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  await prisma.passwordResetCode.update({
    where: { id: rec.id },
    data: { consumedAt: new Date() },
  });
  return { ok: true };
}
