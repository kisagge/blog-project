"use server";
import { getMemberSession } from "@/lib/dal";
import { saveImage, type UploadResult } from "@/lib/save-image";

// 회원 아바타 업로드: 승인 회원만(관리자 전용 uploadImage와 별개 가드).
export async function uploadAvatar(formData: FormData): Promise<UploadResult> {
  const session = await getMemberSession();
  if (!session) return { error: "로그인이 필요합니다." };
  return saveImage(formData.get("file"));
}
