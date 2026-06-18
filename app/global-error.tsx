"use client";

import { useEffect } from "react";
import ErrorFallback from "./error-fallback";
import "./globals.css";

// 루트 레이아웃(app/layout.tsx) 자체가 던지는 치명 예외의 최종 폴백.
// 루트 레이아웃을 대체하므로 자체 html/body를 렌더해야 한다(프로덕션에서만 활성).
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <ErrorFallback retry={unstable_retry} digest={error.digest} />
      </body>
    </html>
  );
}
