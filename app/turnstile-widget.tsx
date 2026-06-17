"use client";
import { useEffect } from "react";
import Script from "next/script";

declare global {
  interface Window {
    turnstile?: { reset: (id?: string) => void };
  }
}

// 액션이 에러를 반환하면 Turnstile 위젯을 리셋(토큰 단일 사용 → 재시도 시 신규 토큰).
// effect 내 외부 API 호출이라 react-hooks 규칙에 안전.
export function useTurnstileReset(state?: { error?: string }) {
  useEffect(() => {
    if (state?.error) window.turnstile?.reset();
  }, [state]);
}

// Cloudflare Turnstile 위젯. siteKey가 없으면 아무것도 렌더하지 않음(기능 비활성).
// 폼 안에 두면 암시적 렌더가 hidden input `cf-turnstile-response`를 주입 → 서버 액션이 읽음.
// 토큰은 단일 사용이라, 폼은 액션 에러 시 window.turnstile.reset()으로 신규 토큰을 받는다.
export default function TurnstileWidget({ siteKey }: { siteKey?: string }) {
  if (!siteKey) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async
        defer
      />
      <div className="cf-turnstile" data-sitekey={siteKey} data-theme="auto" />
    </>
  );
}
