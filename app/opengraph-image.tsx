import { ogImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "BY Playground";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// 사이트 기본 OG 이미지(홈·일반 페이지).
export default function Image() {
  return ogImage("생각과 기록을 남기는 개인 공간");
}
