import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/email";

// 차단 상태로 탈퇴한 회원의 이메일을 원문 없이 해시로만 보관해, 같은 이메일 재가입(차단 회피)을 막는다.
export function emailHash(email: string): string {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

export async function isEmailBlocked(email: string): Promise<boolean> {
  const row = await prisma.blockedEmail.findUnique({
    where: { emailHash: emailHash(email) },
    select: { emailHash: true },
  });
  return row !== null;
}
