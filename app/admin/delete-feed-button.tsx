"use client";
import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { deleteFeed } from "@/app/admin/actions";

/** 삭제 버튼 + 확인 모달. 네이티브 <dialog>로 포커스 트랩·Esc 닫기·백드롭을 처리. */
export function DeleteFeedButton({ id, title }: { id: string; title: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded border border-red-300 px-2 py-1 text-red-600"
      >
        삭제
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`delete-title-${id}`}
        className="bg-background text-foreground m-auto w-[min(90vw,22rem)] rounded-lg border border-black/15 p-5 shadow-xl backdrop:bg-black/40 dark:border-white/20"
      >
        <h2 id={`delete-title-${id}`} className="text-base font-semibold">
          글을 삭제할까요?
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          ‘{title}’ 글이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
        </p>
        <div className="mt-5 flex justify-end gap-2 text-sm">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded border border-black/15 px-3 py-1.5 dark:border-white/20"
          >
            취소
          </button>
          <form action={deleteFeed}>
            <input type="hidden" name="id" value={id} />
            <ConfirmButton />
          </form>
        </div>
      </dialog>
    </>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-red-600 px-3 py-1.5 font-medium text-white disabled:opacity-50"
    >
      {pending ? "삭제 중…" : "삭제"}
    </button>
  );
}
