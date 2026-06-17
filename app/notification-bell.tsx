"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// 헤더 알림 벨. 초기 미읽음 수는 SSR에서 받고(prop), 이후 SSE로 실시간 갱신.
// EventSource는 동일 출처 쿠키를 자동 전송 → 서버 라우트에서 세션 인증. 끊기면 자동 재연결.
// 알림 센터(/notifications)에선 미읽음이 0으로 처리돼 종 배지가 무의미하므로,
// 회원에게는 종 대신 **알림 설정 톱니바퀴**(/account/notifications)를 노출(관리자는 설정 페이지 없음 → 종 유지).
export default function NotificationBell({
  initialUnread,
  isMember,
}: {
  initialUnread: number;
  isMember: boolean;
}) {
  const [unread, setUnread] = useState(initialUnread);
  const pathname = usePathname();

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.addEventListener("unread", (e) => {
      const n = Number((e as MessageEvent).data);
      if (Number.isFinite(n)) setUnread(n);
    });
    return () => es.close();
  }, []);

  if (isMember && pathname === "/notifications") {
    return (
      <Link
        href="/account/notifications"
        aria-label="알림 설정"
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
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </Link>
    );
  }

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
