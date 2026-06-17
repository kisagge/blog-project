"use client";
import ConfirmDialog from "@/app/confirm-dialog";
import { deleteFeed } from "@/app/admin/actions";

/** 삭제 버튼 + 확인 모달(공용 ConfirmDialog). */
export function DeleteFeedButton({ id, title }: { id: string; title: string }) {
  return (
    <ConfirmDialog
      triggerLabel="삭제"
      triggerClassName="rounded border border-red-300 px-2 py-1 text-red-600 disabled:opacity-50"
      pendingLabel="삭제 중…"
      title="글을 삭제할까요?"
      desc={`‘${title}’ 글이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`}
      confirmLabel="삭제"
      confirmClassName="bg-red-600"
      onConfirm={() => {
        const fd = new FormData();
        fd.set("id", id);
        return deleteFeed(fd);
      }}
    />
  );
}
