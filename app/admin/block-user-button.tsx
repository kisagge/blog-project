"use client";
import { useRef, useTransition } from "react";
import { blockUserAction, unblockUserAction } from "@/app/admin/actions";

/** 차단/차단 해제 버튼 + 확인 모달. 네이티브 <dialog>로 포커스 트랩·Esc·백드롭 처리. */
export function BlockUserButton({
  id,
  blocked,
  label,
}: {
  id: string;
  blocked: boolean;
  label: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();

  // 확인 즉시 모달을 닫고 액션 실행. (열린 채로 두면 revalidate 후 blocked가 바뀌어
  // 모달 내용이 '차단↔차단 해제'로 뒤바뀌는 문제가 있어 닫고 진행한다.)
  function confirm() {
    dialogRef.current?.close();
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => (blocked ? unblockUserAction : blockUserAction)(fd));
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => dialogRef.current?.showModal()}
        className={
          blocked
            ? "rounded border border-black/15 px-2 py-1 disabled:opacity-50 dark:border-white/20"
            : "rounded border border-red-300 px-2 py-1 text-red-600 disabled:opacity-50"
        }
      >
        {pending ? "처리 중…" : blocked ? "차단 해제" : "차단"}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`block-title-${id}`}
        className="bg-background text-foreground m-auto w-[min(90vw,24rem)] rounded-lg border border-black/15 p-5 shadow-xl backdrop:bg-black/40 dark:border-white/20"
      >
        <h2 id={`block-title-${id}`} className="text-base font-semibold">
          {blocked ? "차단을 해제할까요?" : "회원을 차단할까요?"}
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          {blocked
            ? `‘${label}’ 회원의 차단을 해제합니다. 다시 로그인·활동할 수 있습니다.`
            : `‘${label}’ 회원을 차단합니다. 로그인·댓글·좋아요·글 작성이 즉시 막힙니다(글·댓글은 보존, 차단 해제 시 원복).`}
        </p>
        <div className="mt-5 flex justify-end gap-2 text-sm">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded border border-black/15 px-3 py-1.5 dark:border-white/20"
          >
            취소
          </button>
          <button
            type="button"
            onClick={confirm}
            className={`rounded px-3 py-1.5 font-medium text-white ${
              blocked ? "bg-zinc-700" : "bg-red-600"
            }`}
          >
            {blocked ? "차단 해제" : "차단"}
          </button>
        </div>
      </dialog>
    </>
  );
}
