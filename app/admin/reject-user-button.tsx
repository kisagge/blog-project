"use client";
import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { rejectUserAction } from "@/app/admin/actions";

/** 거절 버튼 + 사유 입력 모달. 사유는 기록되어 재신청 시 관리자에게 표시된다(신청자엔 비노출). */
export function RejectUserButton({ id, label }: { id: string; label: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded border border-red-300 px-2 py-1 text-red-600"
      >
        거절
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`reject-title-${id}`}
        className="bg-background text-foreground m-auto w-[min(90vw,24rem)] rounded-lg border border-black/15 p-5 shadow-xl backdrop:bg-black/40 dark:border-white/20"
      >
        <h2 id={`reject-title-${id}`} className="text-base font-semibold">
          가입을 거절할까요?
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          ‘{label}’ 신청을 거절합니다. 사유는 관리자 참고용으로 기록되며
          신청자에게는 표시되지 않습니다.
        </p>
        <form action={rejectUserAction} className="mt-4">
          <input type="hidden" name="id" value={id} />
          <textarea
            name="reason"
            rows={3}
            required
            placeholder="거절 사유를 입력하세요"
            className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
          />
          <div className="mt-4 flex justify-end gap-2 text-sm">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded border border-black/15 px-3 py-1.5 dark:border-white/20"
            >
              취소
            </button>
            <ConfirmButton />
          </div>
        </form>
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
      {pending ? "거절 중…" : "거절"}
    </button>
  );
}
