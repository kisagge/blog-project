import "server-only";
import { headers } from "next/headers";
import { clientIpFromXff } from "@/lib/forwarded-ip";

// 서버 액션/RSC 컨텍스트에서 클라이언트 IP(nginx가 덧붙인 x-forwarded-for 마지막 항목). 없으면 undefined.
// proxy.ts는 NextRequest.headers로 같은 clientIpFromXff를 쓴다.
export async function getClientIp(): Promise<string | undefined> {
  return clientIpFromXff((await headers()).get("x-forwarded-for"));
}
