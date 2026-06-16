"use client";
import { useRef, useTransition } from "react";
import {
  hideTargetAction,
  unhideTargetAction,
  dismissReportsAction,
} from "./actions";

type Props = {
  targetType: "comment" | "feed";
  targetId: string;
  slug: string;
  kind: "pending" | "hidden";
};

/** 신고 큐 액션(숨김/기각) 또는 가려진 항목 액션(숨김 해제) + 확인 모달. */
export default function ReportActionButtons({
  targetType,
  targetId,
  slug,
  kind,
}: Props) {
  const hideRef = useRef<HTMLDialogElement>(null);
  const dismissRef = useRef<HTMLDialogElement>(null);
  const unhideRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const what = targetType === "comment" ? "댓글" : "글";

  function run(action: () => Promise<void>, dialog: HTMLDialogElement | null) {
    dialog?.close();
    startTransition(() => action());
  }

  if (kind === "hidden") {
    return (
      <>
        <button
          type="button"
          disabled={pending}
          onClick={() => unhideRef.current?.showModal()}
          className="rounded border border-black/15 px-2 py-1 text-xs disabled:opacity-50 dark:border-white/20"
        >
          {pending ? "처리 중…" : "숨김 해제"}
        </button>
        <ConfirmDialog
          ref={unhideRef}
          title={`${what} 숨김을 해제할까요?`}
          desc="다시 공개 화면에 표시됩니다."
          confirmLabel="숨김 해제"
          confirmClass="bg-zinc-700"
          onConfirm={() =>
            run(
              () => unhideTargetAction(targetType, targetId, slug),
              unhideRef.current,
            )
          }
        />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => hideRef.current?.showModal()}
        className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 disabled:opacity-50"
      >
        숨김
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => dismissRef.current?.showModal()}
        className="rounded border border-black/15 px-2 py-1 text-xs disabled:opacity-50 dark:border-white/20"
      >
        기각
      </button>

      <ConfirmDialog
        ref={hideRef}
        title={`${what}을 숨길까요?`}
        desc="공개 화면(목록·상세·프로필)에서 가려집니다. 신고는 처리됨으로 바뀌고, 언제든 숨김 해제할 수 있습니다."
        confirmLabel="숨김"
        confirmClass="bg-red-600"
        onConfirm={() =>
          run(
            () => hideTargetAction(targetType, targetId, slug),
            hideRef.current,
          )
        }
      />
      <ConfirmDialog
        ref={dismissRef}
        title="신고를 기각할까요?"
        desc="콘텐츠는 그대로 두고 신고만 기각 처리합니다."
        confirmLabel="기각"
        confirmClass="bg-zinc-700"
        onConfirm={() =>
          run(
            () => dismissReportsAction(targetType, targetId, slug),
            dismissRef.current,
          )
        }
      />
    </>
  );
}

function ConfirmDialog({
  ref,
  title,
  desc,
  confirmLabel,
  confirmClass,
  onConfirm,
}: {
  ref: React.RefObject<HTMLDialogElement | null>;
  title: string;
  desc: string;
  confirmLabel: string;
  confirmClass: string;
  onConfirm: () => void;
}) {
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className="bg-background text-foreground m-auto w-[min(90vw,24rem)] rounded-lg border border-black/15 p-5 shadow-xl backdrop:bg-black/40 dark:border-white/20"
    >
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
          onClick={onConfirm}
          className={`rounded px-3 py-1.5 font-medium text-white ${confirmClass}`}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
