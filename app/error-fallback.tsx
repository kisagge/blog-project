"use client";

import { PRIMARY_BTN } from "@/lib/ui";

// error.tsx·global-error.tsx 공유 폴백. 렌더 예외 시 친화적 안내 + 회복 수단.
export default function ErrorFallback({
  retry,
  digest,
}: {
  retry: () => void;
  digest?: string;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      {/* main 랜드마크·h1 위계는 유지하고, 메시지 영역만 alert로 announce. */}
      <div role="alert" className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          문제가 발생했습니다
        </h1>
        <p className="max-w-prose text-zinc-600 dark:text-zinc-400">
          일시적인 오류로 페이지를 표시하지 못했습니다. 다시 시도하거나 잠시 후
          방문해 주세요.
        </p>
      </div>
      <div className="mt-2 flex items-center gap-4">
        <button type="button" onClick={retry} className={PRIMARY_BTN}>
          다시 시도
        </button>
        {/* 순수 <a>로 전체 새로고침 — 크래시 후 잔여 상태를 비우고
            라우터 트리가 끊긴 global-error에서도 동일하게 동작. 의도된 하드 내비라
            next/link 권장 룰을 끈다. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="text-sm underline">
          홈으로
        </a>
      </div>
      {digest && <p className="text-xs text-zinc-400">오류 코드: {digest}</p>}
    </main>
  );
}
