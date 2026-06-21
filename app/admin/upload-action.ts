"use server";
import { verifySession } from "@/lib/dal";
import { saveImage, type UploadResult } from "@/lib/save-image";

// 주의: "use server" 파일은 async 함수만 export해야 한다. 여기서 타입을
// `export type { UploadResult }`로 재-export하면 Turbopack prod 청크가 소거된
// 타입 식별자를 런타임 값으로 참조해 모듈 평가 시 "ReferenceError: UploadResult
// is not defined" → 글 작성/수정 폼 500. 타입은 출처(@/lib/save-image)에서 직접 import한다.

export async function uploadImage(formData: FormData): Promise<UploadResult> {
  await verifySession();
  return saveImage(formData.get("file"));
}
