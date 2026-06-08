export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type ImageCheck = { ok: true; ext: string } | { ok: false; error: string };

export function checkImage(type: string, size: number): ImageCheck {
  const ext = EXT_BY_TYPE[type];
  if (!ext) return { ok: false, error: "jpg/png/webp 이미지만 업로드할 수 있습니다." };
  if (size > MAX_IMAGE_BYTES) return { ok: false, error: "이미지는 5MB 이하만 업로드할 수 있습니다." };
  return { ok: true, ext };
}
