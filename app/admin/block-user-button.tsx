"use client";
import ConfirmDialog from "@/app/confirm-dialog";
import {
  blockUserAction,
  unblockUserAction,
  withdrawMemberAction,
} from "@/app/admin/member-actions";

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
          : "rounded border border-red-300 px-2 py-1 text-red-600 dark:text-red-400 disabled:opacity-50"
      }
      title={blocked ? "차단을 해제할까요?" : "회원을 차단할까요?"}
      desc={
        blocked
          ? `‘${label}’ 회원의 차단을 해제합니다. 다시 로그인·활동할 수 있습니다.`
          : `‘${label}’ 회원을 차단합니다. 로그인 중인 모든 기기에서 즉시 로그아웃되고 로그인·댓글·좋아요·글 작성이 막힙니다(글·댓글은 보존, 차단 해제 시 원복).`
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

/** 차단 회원 탈퇴 처리 버튼(본인이 로그인할 수 없어 삭제 요청 시 관리자가 대행). */
export function WithdrawMemberButton({
  id,
  label,
}: {
  id: string;
  label: string;
}) {
  return (
    <ConfirmDialog
      triggerLabel="탈퇴 처리"
      triggerClassName="rounded border border-red-300 px-2 py-1 text-red-600 dark:text-red-400 disabled:opacity-50"
      title="차단 회원을 탈퇴 처리할까요?"
      desc={`‘${label}’ 회원의 개인정보를 지우고 탈퇴 처리합니다. 글·댓글은 “탈퇴한 회원”으로 남고, 같은 이메일로는 다시 가입할 수 없습니다. 되돌릴 수 없습니다.`}
      confirmLabel="탈퇴 처리"
      confirmClassName="bg-red-600"
      onConfirm={() => {
        const fd = new FormData();
        fd.set("id", id);
        return withdrawMemberAction(fd);
      }}
    />
  );
}
