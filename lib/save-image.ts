import "server-only";
import { randomUUID } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import { join } from "path";
import { checkImage } from "@/lib/upload";
import { imageDimensions } from "@/lib/image-size";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "data/uploads";

export type UploadResult = { url: string } | { error: string };

// 버퍼 헤더(매직바이트)로 실제 이미지 타입을 판별. 클라이언트 MIME 위장을 차단하기 위한 서버측 검증.
export function sniffImageType(buf: Buffer): "jpg" | "png" | "webp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return "jpg";
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  )
    return "png";
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  )
    return "webp";
  return null;
}

// 업로드 이미지 저장 공용 로직(인증 없음 — 호출부가 각자 가드).
// 형식·크기 검증(선언 MIME) + 매직바이트 검증(실제 내용) 후 UUID 파일명으로 저장하고,
// 치수를 URL 쿼리로 실어 반환(CLS 방지). nginx·dev 라우트는 쿼리를 무시하고 파일을 그대로 서빙한다.
export async function saveImage(file: unknown): Promise<UploadResult> {
  if (!(file instanceof File)) return { error: "파일이 없습니다." };

  const check = checkImage(file.type, file.size);
  if (!check.ok) return { error: check.error };

  const buf = Buffer.from(await file.arrayBuffer());
  // 선언 확장자와 실제 매직바이트가 일치해야 저장(jpeg↔jpg 동일시).
  const sniffed = sniffImageType(buf);
  const want = check.ext === "jpeg" ? "jpg" : check.ext;
  if (sniffed !== want) return { error: "이미지 형식이 올바르지 않습니다." };

  const name = `${randomUUID()}.${check.ext}`;
  const dim = imageDimensions(buf);
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(join(UPLOAD_DIR, name), buf);
  const q = dim ? `?w=${dim.width}&h=${dim.height}` : "";
  return { url: `/uploads/${name}${q}` };
}

// 업로드 파일 삭제(아바타 교체·제거 시 이전 파일 정리). best-effort — 미존재 등 에러는 무시.
// `/uploads/<uuid>.<ext>` 형태만 처리해 경로 조작을 차단한다.
export async function deleteUpload(url: string): Promise<void> {
  const m = /^\/uploads\/([a-f0-9-]+\.(?:jpg|jpeg|png|webp))(?:\?.*)?$/.exec(
    url,
  );
  if (!m) return;
  try {
    await unlink(join(UPLOAD_DIR, m[1]));
  } catch {
    /* 이미 없음·권한 등 무시(정리는 비차단) */
  }
}
