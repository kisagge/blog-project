"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

// 헤더 알림 벨. 초기 미읽음 수는 SSR에서 받고(prop), 이후 SSE로 실시간 갱신.
// EventSource는 동일 출처 쿠키를 자동 전송 → 서버 라우트에서 세션 인증. 끊기면 자동 재연결.
export default function NotificationBell({
  initialUnread,
}: {
  initialUnread: number;
}) {
  const [unread, setUnread] = useState(initialUnread);

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.addEventListener("unread", (e) => {
      const n = Number((e as MessageEvent).data);
      if (Number.isFinite(n)) setUnread(n);
    });
    return () => es.close();
  }, []);

  return (
    <Link
      href="/notifications"
      aria-label={`알림${unread > 0 ? ` ${unread}개 안읽음` : ""}`}
      className="relative ml-auto text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {unread > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
      {/* 스크린리더용 실시간 안내(시각 변화는 배지). */}
      <span role="status" aria-live="polite" className="sr-only">
        {unread > 0 ? `안읽은 알림 ${unread}개` : ""}
      </span>
    </Link>
  );
}
