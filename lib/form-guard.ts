import "server-only";
import { getClientIp } from "@/lib/client-ip";
import {
  allowAction,
  TOO_MANY_REQUESTS,
  type ACTION_LIMITS,
} from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

export const CAPTCHA_FAILED = "사람 확인에 실패했습니다. 다시 시도해 주세요.";

// 비로그인 요청 제한 키: 클라이언트 IP(알 수 없으면 "unknown" 한 버킷으로 묶음).
export async function clientIpKey(): Promise<string> {
  return (await getClientIp()) ?? "unknown";
}

// 공개 폼(가입·로그인·재설정 요청) 앞단 공용: IP당 요청 제한 → CAPTCHA.
// 한도를 먼저 보는 이유: 외부 호출(Turnstile) 전에 싸게 차단, CAPTCHA 비활성 환경에서도 무차별 대입 방지.
// 막히면 사용자에게 보일 문구, 통과면 null.
export async function guardPublicForm(
  scope: keyof typeof ACTION_LIMITS,
  formData: FormData,
): Promise<string | null> {
  const ip = await clientIpKey();
  if (!allowAction(scope, ip)) return TOO_MANY_REQUESTS;
  const token = String(formData.get("cf-turnstile-response") ?? "");
  if (!(await verifyTurnstile(token, ip))) return CAPTCHA_FAILED;
  return null;
}
