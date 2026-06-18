import type { NextConfig } from "next";

// 보안 응답 헤더는 next.config 안에 인라인한다: 런타임 이미지가 next.config.ts만 복사하고
// lib/는 복사하지 않으므로(Dockerfile), 여기서 lib을 import하면 기동 시 모듈을 못 찾아
// 컨테이너가 죽는다. 함수는 named export로 노출해 테스트에서 직접 검증한다.
//
// CSP는 nonce 미사용: 이 Next 버전에서 nonce는 전 페이지 동적 렌더를 강제(정적 최적화 포기)
// → 과한 트레이드오프. 대신 script/style은 'unsafe-inline' 허용하되 **외부 스크립트 출처를
// 화이트리스트**로 제한하고 frame-ancestors·object-src·base-uri·form-action을 잠근다.

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

const nextConfig: NextConfig = {
  /* Docker 런너는 pnpm node_modules 전체 + `next start`로 기동하므로 standalone 미사용 */
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  async headers() {
    // 모든 경로에 보안 헤더 적용(정적 자산 포함 — 무해).
    return [{ source: "/(.*)", headers: securityHeaders() }];
  },
};

export default nextConfig;
