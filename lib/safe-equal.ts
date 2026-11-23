import "server-only";
import { timingSafeEqual } from "crypto";

// 비밀값(관리자 비밀번호·cron 시크릿) 상수시간 비교. 길이가 다르면 바로 false(길이 자체는 비밀이 아님).
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
