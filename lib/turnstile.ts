import "server-only";

// Cloudflare Turnstile CAPTCHA 검증. 사이트키·시크릿이 없으면 기능 자체가 비활성(통과).
// 문서: https://developers.cloudflare.com/turnstile/
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// 공개 사이트키. 서버 컴포넌트(page)에서 읽어 폼에 prop으로 전달.
export function turnstileSiteKey(): string | undefined {
  return process.env.TURNSTILE_SITE_KEY || undefined;
}

// 토큰 검증. 시크릿 미설정이면 비활성으로 보고 true(통과).
// 설정 시: 빈 토큰·검증 실패·네트워크 오류는 모두 false(fail-closed).
export async function verifyTurnstile(
  token: string,
  ip?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // 비활성 = 통과(graceful degradation)
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetch(SITEVERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as {
      success?: boolean;
    } | null;
    return res.ok && data?.success === true;
  } catch {
    return false;
  }
}
