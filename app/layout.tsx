import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { getSession } from "@/lib/dal";
import NavDrawer from "@/app/nav-drawer";
import "./globals.css";

// 페인트 전에 data-theme를 확정해 깜빡임 방지 (localStorage 선택 + system은 OS 추종).
const THEME_SCRIPT = `(function(){try{var c=localStorage.getItem('theme')||'system';var d=c==='dark'||(c==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BY Playground",
  description: "BY Playground — 개인 기록 공간",
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
        <header className="border-b border-black/[.08] dark:border-white/[.145]">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-6 py-4">
            <NavDrawer session={navSession} />
            <Link href="/" className="text-lg font-semibold tracking-tight">
              BY Playground
            </Link>
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
        {children}
      </body>
    </html>
  );
}
