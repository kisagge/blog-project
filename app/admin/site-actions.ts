"use server";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import type { FormState } from "@/lib/form-state";
import { setAbout, setPublicEnabled } from "@/lib/site-config";
import { setAdminNickname } from "@/lib/admin-user";
import { AboutSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

// 관리자 사이트 설정 액션: 점검 모드, 관리자 닉네임, 소개 페이지.

// 사이트 점검 토글: 공개 사이트(홈+피드)를 비어드민에게 열고/닫는다.
export async function setSitePublic(formData: FormData) {
  await verifySession();
  const enabled = formData.get("enabled") === "true";
  await setPublicEnabled(enabled);
  await logAudit({
    action: "site.public",
    targetType: "site",
    summary: enabled ? "사이트 공개(점검 해제)" : "사이트 점검 모드 전환",
  });
  revalidatePath("/", "layout"); // 홈·피드·점검 페이지 모두 갱신
  revalidatePath("/admin");
}

export async function setAdminNicknameAction(formData: FormData) {
  await verifySession();
  const nickname = String(formData.get("nickname") ?? "");
  await setAdminNickname(nickname);
  await logAudit({
    action: "admin.nickname",
    targetType: "admin",
    summary: `관리자 닉네임 변경: ${nickname.trim() || "(기본값)"}`,
  });
  revalidatePath("/admin/settings");
}

export type AboutFormState = FormState;

// 소개 페이지 본문 저장(관리자). 비우면 /about·내비 링크가 숨겨진다. 레이아웃(내비)까지 재검증.
export async function saveAboutAction(
  _state: AboutFormState,
  formData: FormData,
): Promise<AboutFormState> {
  await verifySession();
  const parsed = AboutSchema.safeParse({
    content: String(formData.get("content") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await setAbout(parsed.data.content);
  await logAudit({
    action: "site.about",
    targetType: "site",
    summary: parsed.data.content.trim()
      ? `소개 페이지 저장(${parsed.data.content.trim().length}자)`
      : "소개 페이지 비움(비공개)",
  });
  revalidatePath("/", "layout");
  return { done: true };
}
