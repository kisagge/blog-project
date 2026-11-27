"use client";
import ConfirmDialog from "@/app/confirm-dialog";
import {
  hideTargetAction,
  unhideTargetAction,
} from "@/app/admin/reports/actions";

// 관리자: 신고가 없어도 회원 글을 상세 화면에서 바로 숨김/숨김 해제(신고 처리와 같은 동작·작성자 알림).
export default function AdminModerationButton({
  feedId,
  hidden,
}: {
  feedId: string;
  hidden: boolean;
}) {
  return hidden ? (
    <ConfirmDialog
      triggerLabel="숨김 해제"
      triggerClassName="rounded border border-black/15 px-2 py-1 disabled:opacity-50 dark:border-white/20"
      title="글 숨김을 해제할까요?"
      desc="다시 공개 화면에 표시되고, 작성자에게 알림이 갑니다."
      confirmLabel="숨김 해제"
      onConfirm={() => unhideTargetAction("feed", feedId)}
    />
  ) : (
    <ConfirmDialog
      triggerLabel="숨김"
      triggerClassName="rounded border border-red-300 px-2 py-1 text-red-600 disabled:opacity-50 dark:text-red-400"
      title="이 글을 숨길까요?"
      desc="공개 화면(목록·상세·프로필)에서 가려지고, 작성자에게 알림이 갑니다. 걸려 있는 신고는 처리됨으로 바뀝니다. 언제든 숨김 해제할 수 있습니다."
      confirmLabel="숨김"
      confirmClassName="bg-red-600"
      onConfirm={() => hideTargetAction("feed", feedId)}
    />
  );
}
