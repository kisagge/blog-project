"use client";
import Link from "next/link";
import { forwardRef } from "react";

export default forwardRef<HTMLDialogElement>(
  function LoginRequiredModal(_props, ref) {
    return (
      <dialog
        ref={ref}
        className="bg-background text-foreground m-auto w-[min(90vw,22rem)] rounded-lg border border-black/15 p-5 shadow-xl backdrop:bg-black/40 dark:border-white/20"
      >
        <h2 className="text-base font-semibold">로그인이 필요합니다</h2>
        <p className="mt-2 text-sm text-zinc-500">
          댓글·좋아요는 로그인한 회원만 이용할 수 있습니다.
        </p>
        <div className="mt-5 flex justify-end gap-2 text-sm">
          <Link
            href="/signup"
            className="rounded border border-black/15 px-3 py-1.5 dark:border-white/20"
          >
            가입
          </Link>
          <Link
            href="/signin"
            className="bg-foreground text-background rounded px-3 py-1.5 font-medium"
          >
            로그인
          </Link>
        </div>
      </dialog>
    );
  },
);
