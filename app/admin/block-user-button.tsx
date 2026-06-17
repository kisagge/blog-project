"use client";
import ConfirmDialog from "@/app/confirm-dialog";
import { blockUserAction, unblockUserAction } from "@/app/admin/actions";

/** 차단/차단 해제 버튼 + 확인 모달(공용 ConfirmDialog). */
export function BlockUserButton({
  id,
  blocked,
  label,
}: {
  id: string;
  blocked: boolean;
  label: string;
}) {
  return (
    <ConfirmDialog
      triggerLabel={blocked ? "차단 해제" : "차단"}
      triggerClassName={
        blocked
          ? "rounded border border-black/15 px-2 py-1 disabled:opacity-50 dark:border-white/20"
          : "rounded border border-red-300 px-2 py-1 text-red-600 disabled:opacity-50"
      }
      title={blocked ? "차단을 해제할까요?" : "회원을 차단할까요?"}
      desc={
        blocked
          ? `‘${label}’ 회원의 차단을 해제합니다. 다시 로그인·활동할 수 있습니다.`
          : `‘${label}’ 회원을 차단합니다. 로그인·댓글·좋아요·글 작성이 즉시 막힙니다(글·댓글은 보존, 차단 해제 시 원복).`
      }
      confirmLabel={blocked ? "차단 해제" : "차단"}
      confirmClassName={blocked ? "bg-zinc-700" : "bg-red-600"}
      onConfirm={() => {
        const fd = new FormData();
        fd.set("id", id);
        return (blocked ? unblockUserAction : blockUserAction)(fd);
      }}
    />
  );
}
