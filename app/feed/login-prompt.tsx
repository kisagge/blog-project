"use client";
import Link from "next/link";
import { createContext, useContext, useId, useRef } from "react";
import { DIALOG_PANEL } from "@/lib/ui";

// 비로그인 뷰어가 참여 버튼(좋아요·리액션·저장·댓글)을 누르면 띄우는 로그인 안내.
// 버튼마다 <dialog>를 두면 댓글 수만큼 대화상자가 생기므로, 글 참여 영역에 하나만 두고 공유한다.
const LoginPromptContext = createContext<(() => void) | null>(null);

export function LoginPromptProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  return (
    <LoginPromptContext.Provider value={() => ref.current?.showModal()}>
      {children}
      <dialog ref={ref} aria-labelledby={titleId} className={DIALOG_PANEL}>
        <h2 id={titleId} className="text-base font-semibold">
          로그인이 필요합니다
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          댓글·좋아요·반응·저장은 로그인한 회원만 이용할 수 있습니다.
        </p>
        <div className="mt-5 flex justify-end gap-2 text-sm">
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="mr-auto rounded px-3 py-1.5 text-zinc-500 hover:bg-black/[.04] dark:hover:bg-white/[.06]"
          >
            닫기
          </button>
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
    </LoginPromptContext.Provider>
  );
}

// 로그인 안내를 여는 함수. LoginPromptProvider 안에서만 사용.
export function useLoginPrompt(): () => void {
  const open = useContext(LoginPromptContext);
  if (!open)
    throw new Error(
      "useLoginPrompt는 LoginPromptProvider 안에서만 쓸 수 있습니다.",
    );
  return open;
}
