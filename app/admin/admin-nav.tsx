"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useServerEvent } from "@/app/ui/use-server-event";

const TABS = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/stats", label: "통계" },
  { href: "/admin/feeds", label: "글" },
  { href: "/admin/series", label: "시리즈" },
  { href: "/admin/about", label: "소개" },
  { href: "/admin/members", label: "회원" },
  { href: "/admin/reports", label: "신고" },
  { href: "/admin/df", label: "던파" },
  { href: "/admin/settings", label: "설정" },
  { href: "/admin/audit", label: "기록" },
];

export default function AdminNav({
  pendingReports = 0,
  pendingMembers = 0,
}: {
  pendingReports?: number;
  pendingMembers?: number; // 가입 대기(승인 처리 시 레이아웃 재검증으로 갱신)
}) {
  const pathname = usePathname();
  // 미처리 신고 수를 SSE로 라이브 갱신(초기값은 서버 prop). 헤더 알림 벨과 연결 1개 공유.
  const [reports, setReports] = useState(pendingReports);
  useServerEvent("reports", (data) => {
    const n = Number(data);
    if (Number.isFinite(n)) setReports(n);
  });
  // 탭별 배지: 숫자 + 화면 낭독기용 설명(링크 이름에 포함 — 일반 span엔 aria-label을 쓸 수 없음).
  const badges: Record<string, { count: number; label: string }> = {
    "/admin/members": { count: pendingMembers, label: "가입 대기" },
    "/admin/reports": { count: reports, label: "미처리 신고" },
  };

  return (
    <nav aria-label="관리자 메뉴" className="flex gap-4 text-sm">
      {TABS.map((tab) => {
        const active =
          tab.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(tab.href);
        const badge = badges[tab.href];
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "font-semibold"
                : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            }
          >
            {tab.label}
            {badge && badge.count > 0 && (
              <>
                <span
                  aria-hidden
                  className="ml-1 inline-flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white"
                >
                  {badge.count}
                </span>
                <span className="sr-only">
                  {" "}
                  ({badge.label} {badge.count}건)
                </span>
              </>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
