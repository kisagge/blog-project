import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { getSession } from "@/lib/dal";
import { countUnread, notificationRecipientId } from "@/lib/notifications";
import NavDrawer from "@/app/nav-drawer";
import SiteVisitTracker from "@/app/site-visit-tracker";
import ServiceWorkerRegister from "@/app/service-worker-register";
import "./globals.css";

// 페인트 전에 data-theme를 확정해 깜빡임 방지 (localStorage 선택 + system은 OS 추종).
const THEME_SCRIPT = `(function(){try{var c=localStorage.getItem('theme');if(c!=='light'&&c!=='dark'&&c!=='brand')c='brand';document.documentElement.setAttribute('data-theme',c);}catch(e){}})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://by-jang-blog.xyz"),
  title: { default: "BY Playground", template: "%s · BY Playground" },
  description: "생각과 기록을 남기는 개인 공간",
  openGraph: {
    type: "website",
    siteName: "BY Playground",
    title: "BY Playground",
    description: "생각과 기록을 남기는 개인 공간",
    locale: "ko_KR",
  },
  twitter: { card: "summary" },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const navSession =
    session?.role === "member"
      ? { role: "member" as const, nickname: session.nickname }
      : session?.role === "admin"
        ? { role: "admin" as const }
        : null;
  const notifId = await notificationRecipientId();
  const unread = notifId ? await countUnread(notifId) : 0;
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* 페인트 전에 data-theme 확정 → 다크모드 새로고침 깜빡임(FOUC) 방지.
            head에서 실행돼 body 도착·렌더보다 먼저 적용된다. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ServiceWorkerRegister />
        <SiteVisitTracker />
        <a
          href="#main-content"
          className="bg-foreground text-background sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded focus:px-4 focus:py-2 focus:text-sm"
        >
          본문으로 건너뛰기
        </a>
        <header className="border-b border-black/[.08] dark:border-white/[.145]">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-6 py-4">
            <NavDrawer
              session={navSession}
              vapidKey={process.env.VAPID_PUBLIC_KEY}
            />
            <Link href="/" className="text-lg font-semibold tracking-tight">
              BY Playground
            </Link>
            {notifId && (
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
              </Link>
            )}
            {!navSession && (
              <nav className="ml-auto flex items-center gap-4 text-sm">
                <Link
                  href="/signin"
                  className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  로그인
                </Link>
                <Link
                  href="/signup"
                  className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  가입
                </Link>
              </nav>
            )}
          </div>
        </header>
        <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
