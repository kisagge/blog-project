"use client";
import { useActionState } from "react";
import { updateNicknameAction, type AccountState } from "./actions";

const inputCls =
  "rounded border border-black/15 bg-transparent px-3 py-2 dark:border-white/20";

export default function AccountForm({
  email,
  nickname,
}: {
  email: string;
  nickname: string;
}) {
  const [state, action, pending] = useActionState<AccountState, FormData>(
    updateNicknameAction,
    undefined,
  );

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-500">이메일</span>
        <input className={`${inputCls} opacity-60`} value={email} disabled />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-500">닉네임</span>
        <input
          name="nickname"
          defaultValue={nickname}
          maxLength={20}
          className={inputCls}
        />
        {state?.errors?.nickname && (
          <span className="text-xs text-red-600">
            {state.errors.nickname[0]}
          </span>
        )}
      </label>

      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state?.done && (
        <p role="status" className="text-sm text-green-600">
          닉네임을 변경했습니다.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-foreground text-background rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "저장 중…" : "저장"}
      </button>
    </form>
  );
}
