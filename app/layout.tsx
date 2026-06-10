import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { getSession } from "@/lib/dal";
import { logout } from "@/app/actions/auth";
import ThemeToggle from "@/app/theme-toggle";
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
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <header className="border-b border-black/[.08] dark:border-white/[.145]">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              BY Playground
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/feed"
                className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Feed
              </Link>
              {session?.role === "member" ? (
                <>
                  <span className="text-zinc-500">{session.nickname}</span>
                  <form action={logout}>
                    <button
                      type="submit"
                      className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                    >
                      로그아웃
                    </button>
                  </form>
                </>
              ) : session?.role === "admin" ? (
                <Link
                  href="/admin"
                  className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  관리자
                </Link>
              ) : (
                <>
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
                </>
              )}
              <ThemeToggle />
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
