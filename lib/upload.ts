export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// 우리 업로드 경로: `/uploads/<uuid>.<ext>[?w=&h=]`. 1번 그룹 = 디스크 파일명.
// 아바타 검증(validation)·파일명 추출(save-image) 공용 — 클라이언트에서도 import 가능한 모듈이라 여기 둔다.
export const UPLOAD_URL_RE =
  /^\/uploads\/([a-f0-9-]+\.(?:jpg|jpeg|png|webp))(?:\?.*)?$/;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type ImageCheck =
  { ok: true; ext: string } | { ok: false; error: string };

export function checkImage(type: string, size: number): ImageCheck {
  const ext = EXT_BY_TYPE[type];
  if (!ext)
    return { ok: false, error: "jpg/png/webp 이미지만 업로드할 수 있습니다." };
  if (size > MAX_IMAGE_BYTES)
    return {
      ok: false,
      error: `이미지는 ${MAX_IMAGE_BYTES / 1024 / 1024}MB 이하만 업로드할 수 있습니다.`,
    };
  return { ok: true, ext };
}
