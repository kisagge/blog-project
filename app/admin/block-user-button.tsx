"use client";
import { useRef } from "react";
import { useFormStatus } from "react-dom";
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

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={
          blocked
            ? "rounded border border-black/15 px-2 py-1 dark:border-white/20"
            : "rounded border border-red-300 px-2 py-1 text-red-600"
        }
      >
        {blocked ? "차단 해제" : "차단"}
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
          <form action={blocked ? unblockUserAction : blockUserAction}>
            <input type="hidden" name="id" value={id} />
            <ConfirmButton blocked={blocked} />
          </form>
        </div>
      </dialog>
    </>
  );
}

function ConfirmButton({ blocked }: { blocked: boolean }) {
  const { pending } = useFormStatus();
  const label = blocked ? "차단 해제" : "차단";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded px-3 py-1.5 font-medium text-white disabled:opacity-50 ${
        blocked ? "bg-zinc-700" : "bg-red-600"
      }`}
    >
      {pending ? "처리 중…" : label}
    </button>
  );
}
