// HTTP 보안 응답 헤더. next.config.ts의 headers()와 테스트가 공유한다.
// 순수 모듈(외부 import 없음) — next.config가 안전하게 가져올 수 있게.
//
// CSP는 nonce를 쓰지 않는다: 이 Next 버전에서 nonce는 전 페이지 동적 렌더를 강제해
// 정적 최적화·캐싱을 포기하게 되는데, 개인 블로그엔 과한 트레이드오프다. 대신
// script/style은 'unsafe-inline'을 허용하되(레이아웃 테마 스크립트·Next 런타임 인라인·
// 인라인 style 속성 때문) **외부 스크립트 출처는 화이트리스트로 제한**하고,
// frame-ancestors·object-src·base-uri·form-action을 잠가 클릭재킹·인젝션 표면을 줄인다.

const CF = "https://challenges.cloudflare.com"; // Turnstile 스크립트 + 위젯 iframe
const KAKAO_SDK = "https://t1.kakaocdn.net"; // 카카오 공유 SDK 스크립트
const KAKAO_API = "https://*.kakao.com"; // 카카오 SDK XHR

export function contentSecurityPolicy(isDev: boolean): string {
  const directives = [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    // dev는 React가 eval로 에러 스택을 복원하므로 'unsafe-eval' 필요(prod 불필요).
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${CF} ${KAKAO_SDK}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`, // 본문 마크다운의 외부 https 이미지 허용
    `font-src 'self'`, // next/font는 빌드 타임 self-host
    `connect-src 'self' ${CF} ${KAKAO_API}`,
    `frame-src ${CF}`,
    `worker-src 'self'`,
    `manifest-src 'self'`,
    // 로컬 http 개발 깨짐 방지로 dev에선 제외.
    ...(isDev ? [] : [`upgrade-insecure-requests`]),
  ];
  return directives.join("; ");
}

export function securityHeaders(
  isDev = process.env.NODE_ENV !== "production",
): { key: string; value: string }[] {
  const headers = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(isDev) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    },
  ];
  // HSTS는 https에서만 의미가 있어 prod 응답에만.
  if (!isDev) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  }
  return headers;
}
