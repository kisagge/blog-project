"use server";
import { getMemberSession } from "@/lib/dal";
import { saveImage, type UploadResult } from "@/lib/save-image";
import { allowAction, TOO_MANY_REQUESTS } from "@/lib/rate-limit";

// 회원 본문 이미지 업로드: 승인 회원만(관리자 전용 uploadImage와 별개 가드, 아바타와 동형).
export async function uploadPostImage(
  formData: FormData,
): Promise<UploadResult> {
  const session = await getMemberSession();
  if (!session) return { error: "로그인이 필요합니다." };
  if (!allowAction("postImageUpload", session.userId))
    return { error: TOO_MANY_REQUESTS };
  return saveImage(formData.get("file"));
}
