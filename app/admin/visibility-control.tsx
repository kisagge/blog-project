"use client";
import { useRef } from "react";
import {
  VISIBILITIES,
  VISIBILITY_LABELS,
  type Visibility,
} from "@/lib/visibility";

// 현재 공개 범위를 보여주는 버튼 + 클릭 시 모달에서 선택. 선택 즉시 onSelect 호출.
export default function VisibilityControl({
  value,
  onSelect,
}: {
  value: Visibility;
  onSelect: (v: Visibility) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="rounded border border-black/15 px-2 py-1 text-xs dark:border-white/20"
      >
        {VISIBILITY_LABELS[value]}
      </button>
      <dialog
        ref={ref}
        aria-label="공개 범위 선택"
        className="bg-background text-foreground m-auto w-[min(90vw,16rem)] rounded-lg border border-black/15 p-4 shadow-xl backdrop:bg-black/40 dark:border-white/20"
      >
        <h2 className="mb-3 text-sm font-semibold">공개 범위</h2>
        <ul className="flex flex-col gap-1">
          {VISIBILITIES.map((v) => (
            <li key={v}>
              <button
                type="button"
                onClick={() => {
                  onSelect(v);
                  ref.current?.close();
                }}
                className={`flex w-full items-center justify-between rounded px-3 py-2 text-sm hover:bg-black/[.04] dark:hover:bg-white/[.06] ${
                  v === value ? "font-semibold" : ""
                }`}
              >
                {VISIBILITY_LABELS[v]}
                {v === value && <span aria-hidden>✓</span>}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className="mt-3 w-full rounded border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
        >
          닫기
        </button>
      </dialog>
    </>
  );
}
