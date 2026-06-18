"use client";

// 저장된 초안이 있을 때 표시하는 복원 안내(자동 덮어쓰기 안 함 — 사용자가 선택).
export default function DraftRestoreBanner({
  onRestore,
  onDismiss,
}: {
  onRestore: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-200"
    >
      <span className="mr-auto">임시 저장한 내용이 있습니다.</span>
      <button
        type="button"
        onClick={onRestore}
        className="rounded-full bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
      >
        복원
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-full px-3 py-1 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/50"
      >
        무시
      </button>
    </div>
  );
}
