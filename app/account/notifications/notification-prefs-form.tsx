"use client";
import { useActionState, useState } from "react";
import { PRIMARY_BTN } from "@/lib/ui";
import { updateNotificationPrefsAction, type NotifPrefsState } from "./actions";

export default function NotificationPrefsForm({
  prefs,
}: {
  prefs: { onReply: boolean; onComment: boolean };
}) {
  const [state, action, pending] = useActionState<NotifPrefsState, FormData>(
    updateNotificationPrefsAction,
    undefined,
  );
  // controlled 체크박스 + 초기 prefs와 비교해 변경 없으면 저장 비활성화.
  const [onReply, setOnReply] = useState(prefs.onReply);
  const [onComment, setOnComment] = useState(prefs.onComment);
  const dirty = onReply !== prefs.onReply || onComment !== prefs.onComment;

  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-5">
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">알림 종류</legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="onReply"
            checked={onReply}
            onChange={(e) => setOnReply(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <span className="font-medium">답글 알림</span>
            <span className="block text-zinc-500">
              내 댓글에 답글이 달리면 알림을 받습니다.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="onComment"
            checked={onComment}
            onChange={(e) => setOnComment(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <span className="font-medium">내 글 댓글 알림</span>
            <span className="block text-zinc-500">
              내가 쓴 글에 댓글이 달리면 알림을 받습니다.
            </span>
          </span>
        </label>
      </fieldset>

      {state?.done && (
        <p role="status" className="text-sm text-green-600">
          알림 설정을 저장했습니다.
        </p>
      )}
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !dirty}
        className={PRIMARY_BTN}
      >
        {pending ? "저장 중…" : "저장"}
      </button>
    </form>
  );
}
