"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/app/theme-toggle";
import PushToggle from "@/app/push-toggle";
import { logout } from "@/app/actions/auth";

type NavSession =
  | { role: "admin" }
  | { role: "member"; nickname: string }
  | null;

export default function NavDrawer({
  session,
  vapidKey,
}: {
  session: NavSession;
  vapidKey?: string;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // 열렸을 때: 스크롤 잠금 + 첫 요소 포커스 + Esc/Tab(포커스 트랩) + 닫힐 때 트리거로 복귀.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const trigger = triggerRef.current; // 닫힐 때 포커스 복귀 대상(캡처)
    const panel = panelRef.current;
    const focusables = () =>
      panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])',
            ),
          )
        : [];
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "Tab") {
        const els = focusables();
        if (els.length === 0) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="메뉴 열기"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="-ml-1 rounded p-1 text-zinc-600 hover:bg-black/[.04] dark:text-zinc-300 dark:hover:bg-white/[.06]"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 6h16M4 12h16M4 18h16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={close}
          aria-hidden
        />
      )}

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="메뉴"
        inert={!open}
        className={`bg-background fixed top-0 left-0 z-50 flex h-full w-64 flex-col border-r border-black/[.08] transition-transform duration-200 dark:border-white/[.145] ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-lg font-semibold tracking-tight">메뉴</span>
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={close}
            className="rounded p-1 text-zinc-500 hover:bg-black/[.04] dark:hover:bg-white/[.06]"
          >
            ✕
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 text-sm">
          <DrawerLink href="/feed" onClick={close}>
            피드
          </DrawerLink>
          <DrawerLink href="/community" onClick={close}>
            커뮤니티
          </DrawerLink>
          <DrawerLink href="/df" onClick={close}>
            던파
          </DrawerLink>
          <DrawerLink href="/feed/popular" onClick={close}>
            인기 글
          </DrawerLink>
          <DrawerLink href="/feed/tags" onClick={close}>
            태그
          </DrawerLink>
          {session?.role === "admin" && (
            <DrawerLink href="/admin" onClick={close}>
              관리자
            </DrawerLink>
          )}

          <Divider />

          {session?.role === "member" ? (
            <>
              <DrawerLink href="/account/posts/new" onClick={close}>
                글쓰기
              </DrawerLink>
              <DrawerLink href="/me" onClick={close}>
                내 프로필
              </DrawerLink>
              <DrawerLink href="/account/saved" onClick={close}>
                저장한 글
              </DrawerLink>
              <DrawerLink href="/account" onClick={close}>
                내 정보
              </DrawerLink>
              <PushToggle vapidKey={vapidKey} />
              <LogoutButton />
            </>
          ) : session?.role === "admin" ? (
            <LogoutButton />
          ) : (
            <>
              <DrawerLink href="/signin" onClick={close}>
                로그인
              </DrawerLink>
              <DrawerLink href="/signup" onClick={close}>
                가입
              </DrawerLink>
            </>
          )}

          <Divider />
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-zinc-500">테마</span>
            <ThemeToggle />
          </div>
        </nav>
      </aside>
    </>
  );
}

function DrawerLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="rounded px-3 py-2 hover:bg-black/[.04] dark:hover:bg-white/[.06]"
    >
      {children}
    </Link>
  );
}

function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="w-full rounded px-3 py-2 text-left text-zinc-600 hover:bg-black/[.04] dark:text-zinc-300 dark:hover:bg-white/[.06]"
      >
        로그아웃
      </button>
    </form>
  );
}

function Divider() {
  return (
    <div className="my-2 border-t border-black/[.08] dark:border-white/[.145]" />
  );
}
