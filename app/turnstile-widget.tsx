"use client";
import { useEffect, useRef } from "react";
import Script from "next/script";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          theme?: "auto" | "light" | "dark";
          "expired-callback"?: () => void;
        },
      ) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

// Cloudflare Turnstile 위젯. siteKey가 없으면 아무것도 렌더하지 않음(기능 비활성).
//
// **명시 렌더**(turnstile.render)를 쓴다. 암시적 자동 렌더(.cf-turnstile 스캔)는 api.js가
// 최초 로드될 때 1회만 스캔하므로, SPA 내비게이션(예: 로그인→비밀번호 찾기 링크)으로
// 진입하면 새 컨테이너가 렌더되지 않아 토큰이 비고 검증이 실패한다(그리고 reset이 대상
// 위젯을 못 찾아 throw → 화면이 깨졌다). `next/script`의 onReady는 **매 마운트마다** 호출돼
// 내비게이션 후에도 위젯을 확실히 렌더한다. 토큰 hidden input(cf-turnstile-response)은
// render가 컨테이너에 주입하므로 폼 제출 시 서버 액션이 그대로 읽는다.
//
// resetSignal: 폼 액션이 에러를 반환하면(토큰 단일 사용) 위젯을 리셋해 새 토큰을 받는다.
export default function TurnstileWidget({
  siteKey,
  resetSignal,
}: {
  siteKey?: string;
  resetSignal?: { error?: string };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);

  function renderWidget() {
    const el = ref.current;
    if (!siteKey || !el || !window.turnstile || widgetId.current !== undefined)
      return;
    try {
      widgetId.current = window.turnstile.render(el, {
        sitekey: siteKey,
        theme: "auto",
        // 토큰은 ~300초 후 만료 → 폼에 머무는 사용자를 위해 자동으로 새 토큰 발급.
        "expired-callback": () => {
          try {
            window.turnstile?.reset(widgetId.current);
          } catch {
            /* 위젯 없음 — 무시 */
          }
        },
      });
    } catch {
      // 렌더 실패는 무시 — 빈 토큰이 되고 서버 검증이 fail-closed로 거부.
    }
  }

  // 언마운트 시 위젯 정리(재마운트 시 중복 렌더 방지).
  useEffect(() => {
    return () => {
      if (widgetId.current !== undefined) {
        try {
          window.turnstile?.remove(widgetId.current);
        } catch {
          /* 이미 제거됨 */
        }
        widgetId.current = undefined;
      }
    };
  }, []);

  // 액션 에러 시 토큰 리셋. 위젯이 아직 없으면 reset이 throw하므로 try/catch로 감싼다
  // (미처리 예외가 화면을 깨뜨리지 않도록).
  // deps는 의도적으로 `resetSignal`(state 객체 신원) — `resetSignal?.error`로 좁히면
  // 연속 동일 에러 메시지에서 effect가 재실행되지 않아 reset이 누락된다(토큰 단일 사용).
  useEffect(() => {
    if (!resetSignal?.error) return;
    try {
      window.turnstile?.reset(widgetId.current);
    } catch {
      /* 리셋할 위젯 없음 — 무시 */
    }
  }, [resetSignal]);

  if (!siteKey) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        onReady={renderWidget}
      />
      <div ref={ref} data-testid="turnstile" />
    </>
  );
}
