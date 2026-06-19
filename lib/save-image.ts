import "server-only";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { checkImage } from "@/lib/upload";
import { imageDimensions } from "@/lib/image-size";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "data/uploads";

export type UploadResult = { url: string } | { error: string };

// 업로드 이미지 저장 공용 로직(인증 없음 — 호출부가 각자 가드).
// 형식·크기 검증 후 UUID 파일명으로 저장하고, 치수를 URL 쿼리로 실어 반환(CLS 방지).
// nginx·dev 라우트는 쿼리를 무시하고 파일을 그대로 서빙한다.
export async function saveImage(file: unknown): Promise<UploadResult> {
  if (!(file instanceof File)) return { error: "파일이 없습니다." };

  const check = checkImage(file.type, file.size);
  if (!check.ok) return { error: check.error };

  const name = `${randomUUID()}.${check.ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const dim = imageDimensions(buf);
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(join(UPLOAD_DIR, name), buf);
  const q = dim ? `?w=${dim.width}&h=${dim.height}` : "";
  return { url: `/uploads/${name}${q}` };
}
