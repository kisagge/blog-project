"use client";
import { useRef, useTransition } from "react";
import { DIALOG_PANEL } from "@/lib/ui";

// 트리거 버튼 + 확인 모달 공용 컴포넌트. 네이티브 <dialog>로 포커스 트랩·Esc·백드롭 처리.
// 확인 즉시 모달을 닫고 onConfirm을 transition으로 실행(revalidate로 prop이 바뀌어도 모달이
// 뒤바뀌지 않도록 — block 토글 버그 학습 반영). 사유 입력 등 폼형 모달엔 부적합(별도 구현).
export default function ConfirmDialog({
  triggerLabel,
  triggerClassName,
  pendingLabel = "처리 중…",
  title,
  desc,
  confirmLabel,
  confirmClassName = "bg-zinc-700",
  onConfirm,
}: {
  triggerLabel: string;
  triggerClassName: string;
  pendingLabel?: string;
  title: string;
  desc: string;
  confirmLabel: string;
  confirmClassName?: string;
  onConfirm: () => void | Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => ref.current?.showModal()}
        className={triggerClassName}
      >
        {pending ? pendingLabel : triggerLabel}
      </button>
      <dialog ref={ref} aria-label={title} className={DIALOG_PANEL}>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-zinc-500">{desc}</p>
        <div className="mt-5 flex justify-end gap-2 text-sm">
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="rounded border border-black/15 px-3 py-1.5 dark:border-white/20"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => {
              ref.current?.close();
              startTransition(() => onConfirm());
            }}
            className={`rounded px-3 py-1.5 font-medium text-white ${confirmClassName}`}
          >
            {confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  );
}
