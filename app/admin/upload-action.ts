"use server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { verifySession } from "@/lib/dal";
import { checkImage } from "@/lib/upload";
import { imageDimensions } from "@/lib/image-size";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "data/uploads";

export type UploadResult = { url: string } | { error: string };

export async function uploadImage(formData: FormData): Promise<UploadResult> {
  await verifySession();
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "파일이 없습니다." };

  const check = checkImage(file.type, file.size);
  if (!check.ok) return { error: check.error };

  const name = `${randomUUID()}.${check.ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  // 치수를 URL 쿼리로 실어 렌더 시 width/height로 공간 예약(CLS 방지). nginx·dev 라우트는 쿼리 무시.
  const dim = imageDimensions(buf);
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(join(UPLOAD_DIR, name), buf);
  const q = dim ? `?w=${dim.width}&h=${dim.height}` : "";
  return { url: `/uploads/${name}${q}` };
}
