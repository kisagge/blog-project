"use client";

import { useEffect } from "react";
import ErrorFallback from "./error-fallback";

// 루트 세그먼트 에러 바운더리 — 더 가까운 error.tsx가 없는 모든 페이지의 렌더
// 예외를 잡는다. 루트 레이아웃 안쪽에서 렌더되므로 헤더는 유지된다.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // 외부 에러 추적 서비스는 도입 안 함(YAGNI) — 서버 로그로 충분.
    console.error(error);
  }, [error]);

  return <ErrorFallback retry={unstable_retry} digest={error.digest} />;
}
