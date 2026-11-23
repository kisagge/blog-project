import { useState } from "react";
import { checkImage } from "@/lib/upload";

export const UPLOAD_FAILED =
  "업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.";

export type UploadResult = { url: string } | { error: string };

// 파일 입력의 change 이벤트에서 파일을 꺼내고 입력을 비운다(같은 파일 재선택 허용).
export function takeFile(e: React.ChangeEvent<HTMLInputElement>): File | null {
  const file = e.target.files?.[0] ?? null;
  e.target.value = "";
  return file;
}

// 이미지 업로드 공용(본문·소개·아바타): 형식·크기 선검증 → 서버 액션 호출 → 결과.
// 선검증은 본문 크기 한도(bodySizeLimit)에 걸려 액션이 예외로 끝나는 것을 막고 즉시 안내하기 위함.
// 액션이 예외로 끝나도(네트워크·한도) uploading은 반드시 풀린다.
export function useImageUpload(
  upload: (fd: FormData) => Promise<UploadResult>,
) {
  const [uploading, setUploading] = useState(false);

  async function uploadFile(file: File): Promise<UploadResult> {
    const check = checkImage(file.type, file.size);
    if (!check.ok) return { error: check.error };
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    try {
      return await upload(fd);
    } catch {
      return { error: UPLOAD_FAILED };
    } finally {
      setUploading(false);
    }
  }

  return { uploading, uploadFile };
}
