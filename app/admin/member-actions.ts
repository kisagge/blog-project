"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { approveUser, blockUser, unblockUser, rejectUser } from "@/lib/users";
import { logAudit } from "@/lib/audit";

// 관리자 회원 액션: 가입 승인·거절, 차단·해제.

// 감사 요약용: 회원 닉네임(없으면 id 일부).
async function memberLabel(id: string): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { id },
    select: { nickname: true },
  });
  return u?.nickname ?? id.slice(0, 8);
}

export async function approveUserAction(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  await approveUser(id);
  await logAudit({
    action: "member.approve",
    targetType: "member",
    targetId: id,
    summary: `회원 승인: ${await memberLabel(id)}`,
  });
  revalidatePath("/admin", "layout"); // 회원 관리 탭(대기/회원) 모두 갱신
}

export async function rejectUserAction(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "");
  await rejectUser(id, reason);
  await logAudit({
    action: "member.reject",
    targetType: "member",
    targetId: id,
    summary: `회원 거절: ${await memberLabel(id)}${reason ? ` (${reason})` : ""}`,
  });
  revalidatePath("/admin", "layout");
}

export async function blockUserAction(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  await blockUser(id);
  await logAudit({
    action: "member.block",
    targetType: "member",
    targetId: id,
    summary: `회원 차단: ${await memberLabel(id)}`,
  });
  revalidatePath("/admin/members");
}

export async function unblockUserAction(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  await unblockUser(id);
  await logAudit({
    action: "member.unblock",
    targetType: "member",
    targetId: id,
    summary: `회원 차단 해제: ${await memberLabel(id)}`,
  });
  revalidatePath("/admin/members");
}
