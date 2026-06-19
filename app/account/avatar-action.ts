"use server";
import { getMemberSession } from "@/lib/dal";
import { saveImage, type UploadResult } from "@/lib/save-image";
import { allowAction, TOO_MANY_REQUESTS } from "@/lib/rate-limit";

// 회원 아바타 업로드: 승인 회원만(관리자 전용 uploadImage와 별개 가드).
export async function uploadAvatar(formData: FormData): Promise<UploadResult> {
  const session = await getMemberSession();
  if (!session) return { error: "로그인이 필요합니다." };
  // 반복 업로드로 디스크를 채우는 남용 방지(회원별 한도).
  if (!allowAction("avatarUpload", session.userId))
    return { error: TOO_MANY_REQUESTS };
  return saveImage(formData.get("file"));
}
