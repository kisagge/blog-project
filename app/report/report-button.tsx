"use client";
import { useRef, useState, useTransition } from "react";
import { submitReportAction } from "./report-actions";
import {
  REPORT_REASONS,
  REPORT_REASON_ORDER,
  type ReportTargetType,
} from "@/lib/report-reasons";

/** 콘텐츠 신고 버튼 + 사유 선택 모달. 네이티브 <dialog>로 포커스 트랩·Esc·백드롭 처리. */
export default function ReportButton({
  targetType,
  targetId,
  triggerClassName = "hover:text-red-600",
}: {
  targetType: ReportTargetType;
  targetId: string;
  triggerClassName?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const titleId = `report-title-${targetId}`;
  const detailId = `report-detail-${targetId}`;

  // 신고 완료 후에는(중복 신고 불가) 버튼을 안내 텍스트로 대체.
  if (done) {
    return (
      <span role="status" className="text-xs text-zinc-400">
        신고 접수됨
      </span>
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await submitReportAction({ targetType, targetId }, fd);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      dialogRef.current?.close();
      setDone(true);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={triggerClassName}
      >
        신고
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="bg-background text-foreground m-auto w-[min(90vw,26rem)] rounded-lg border border-black/15 p-5 shadow-xl backdrop:bg-black/40 dark:border-white/20"
      >
        <form onSubmit={onSubmit}>
          <h2 id={titleId} className="text-base font-semibold">
            {targetType === "comment" ? "댓글 신고" : "글 신고"}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            부적절한 콘텐츠를 관리자에게 알립니다. 사유를 선택해 주세요.
          </p>

          <fieldset className="mt-4 flex flex-col gap-2">
            <legend className="sr-only">신고 사유</legend>
            {REPORT_REASON_ORDER.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  required
                  className="accent-red-600"
                />
                {REPORT_REASONS[r]}
              </label>
            ))}
          </fieldset>

          <label
            htmlFor={detailId}
            className="mt-4 block text-sm text-zinc-500"
          >
            상세 설명 (선택)
          </label>
          <textarea
            id={detailId}
            name="detail"
            rows={3}
            maxLength={500}
            placeholder="구체적인 사유가 있다면 적어 주세요."
            className="mt-1 w-full resize-none rounded-lg border border-black/15 bg-transparent p-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
          />

          {error && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2 text-sm">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded border border-black/15 px-3 py-1.5 dark:border-white/20"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-red-600 px-3 py-1.5 font-medium text-white disabled:opacity-50"
            >
              {pending ? "접수 중…" : "신고"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
