"use client";
import ConfirmDialog from "@/app/confirm-dialog";
import { restoreRevisionAction } from "@/app/admin/actions";

/** 이 버전으로 되돌리기 + 확인 모달(공용 ConfirmDialog). 현재 버전은 이력으로 남는다. */
export default function RestoreButton({ revisionId }: { revisionId: string }) {
  return (
    <ConfirmDialog
      triggerLabel="이 버전으로 되돌리기"
      triggerClassName="rounded border border-black/15 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/20"
      pendingLabel="되돌리는 중…"
      title="이 버전으로 되돌릴까요?"
      desc="제목·요약·본문이 이 버전으로 바뀝니다. 지금 버전은 수정 이력에 남아 다시 되돌릴 수 있습니다."
      confirmLabel="되돌리기"
      onConfirm={() => restoreRevisionAction(revisionId)}
    />
  );
}
