"use client";
import ConfirmDialog from "@/app/confirm-dialog";
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

const OUTLINE = "rounded border border-black/15 px-2 py-1 text-xs disabled:opacity-50 dark:border-white/20";
const DANGER_OUTLINE = "rounded border border-red-300 px-2 py-1 text-xs text-red-600 disabled:opacity-50";

/** 신고 큐 액션(숨김/기각) 또는 가려진 항목 액션(숨김 해제). 공용 ConfirmDialog 사용. */
export default function ReportActionButtons({
  targetType,
  targetId,
  slug,
  kind,
}: Props) {
  const what = targetType === "comment" ? "댓글" : "글";

  if (kind === "hidden") {
    return (
      <ConfirmDialog
        triggerLabel="숨김 해제"
        triggerClassName={OUTLINE}
        title={`${what} 숨김을 해제할까요?`}
        desc="다시 공개 화면에 표시됩니다."
        confirmLabel="숨김 해제"
        onConfirm={() => unhideTargetAction(targetType, targetId, slug)}
      />
    );
  }

  return (
    <>
      <ConfirmDialog
        triggerLabel="숨김"
        triggerClassName={DANGER_OUTLINE}
        title={`${what}을 숨길까요?`}
        desc="공개 화면(목록·상세·프로필)에서 가려집니다. 신고는 처리됨으로 바뀌고, 언제든 숨김 해제할 수 있습니다."
        confirmLabel="숨김"
        confirmClassName="bg-red-600"
        onConfirm={() => hideTargetAction(targetType, targetId, slug)}
      />
      <ConfirmDialog
        triggerLabel="기각"
        triggerClassName={OUTLINE}
        title="신고를 기각할까요?"
        desc="콘텐츠는 그대로 두고 신고만 기각 처리합니다."
        confirmLabel="기각"
        onConfirm={() => dismissReportsAction(targetType, targetId, slug)}
      />
    </>
  );
}
