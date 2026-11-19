"use client";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/app/confirm-dialog";
import { deleteMyPostAction } from "./actions";

// 회원 글 삭제 + 확인 모달. 게시 글을 지우면 달린 댓글도 함께 삭제(Cascade)되므로 바로 지우지 않는다.
// 글 상세처럼 삭제 후 머물 페이지가 없어지는 곳에선 redirectTo로 이동.
export default function DeletePostButton({
  id,
  title,
  kind,
  redirectTo,
}: {
  id: string;
  title: string;
  kind: "draft" | "post";
  redirectTo?: string;
}) {
  const router = useRouter();
  return (
    <ConfirmDialog
      triggerLabel="삭제"
      triggerAriaLabel={`‘${title}’ 삭제`}
      triggerClassName="text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
      pendingLabel="삭제 중…"
      title={
        kind === "draft" ? "임시저장 글을 삭제할까요?" : "글을 삭제할까요?"
      }
      desc={
        kind === "draft"
          ? `‘${title}’ 임시저장을 삭제합니다. 되돌릴 수 없습니다.`
          : `‘${title}’ 글과 달린 댓글·좋아요가 모두 삭제되며 되돌릴 수 없습니다.`
      }
      confirmLabel="삭제"
      confirmClassName="bg-red-600"
      onConfirm={async () => {
        const fd = new FormData();
        fd.set("id", id);
        await deleteMyPostAction(fd);
        if (redirectTo) router.push(redirectTo);
      }}
    />
  );
}
