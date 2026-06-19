import "server-only";
import { headers } from "next/headers";

// 서버 액션/RSC 컨텍스트에서 클라이언트 IP(x-forwarded-for 첫 항목). 없으면 undefined.
// proxy.ts는 NextRequest.headers라 별도 처리.
export async function getClientIp(): Promise<string | undefined> {
  return (
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || undefined
  );
}
