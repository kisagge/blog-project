import "server-only";
import { imageSize } from "image-size";

// 이미지 버퍼에서 픽셀 치수를 읽는다(헤더 바이트만 파싱, 디코딩 없음).
// 손상·미지원 포맷은 null — 업로드는 계속되고 CLS 쿼리만 생략된다.
// lib/upload.ts는 클라이언트(checkImage)에서도 import되므로 image-size는 이 server-only 모듈에 격리.
export function imageDimensions(
  buf: Buffer,
): { width: number; height: number } | null {
  try {
    const r = imageSize(buf);
    return r?.width && r?.height ? { width: r.width, height: r.height } : null;
  } catch {
    return null;
  }
}
