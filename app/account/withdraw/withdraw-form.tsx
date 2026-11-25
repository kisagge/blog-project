"use client";
import { useActionState } from "react";
import { INPUT_CLASS } from "@/lib/ui";
import FormField from "@/app/ui/form-field";
import { withdrawAction, type WithdrawState } from "./actions";

// 회원 탈퇴 폼: 처리 방식 안내 + 글 삭제 선택 + 확인 체크 + 비밀번호 재확인.
export default function WithdrawForm() {
  const [state, action, pending] = useActionState<WithdrawState, FormData>(
    withdrawAction,
    undefined,
  );
  const confirmError = state?.errors?.confirm;
  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 text-sm">
        <label className="flex items-start gap-2">
          <input type="checkbox" name="deletePosts" className="mt-1" />
          <span>
            내가 쓴 글도 함께 삭제합니다.
            <span className="block text-xs text-zinc-500">
              글에 달린 다른 회원의 댓글도 함께 사라집니다. 선택하지 않으면 글은
              “탈퇴한 회원” 이름으로 남습니다.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            name="confirm"
            className="mt-1"
            aria-invalid={confirmError ? true : undefined}
            aria-describedby={
              confirmError ? "withdraw-confirm-error" : undefined
            }
          />
          <span>
            위 안내를 확인했으며, 탈퇴 후에는 되돌릴 수 없음을 이해합니다.
          </span>
        </label>
        {confirmError && (
          <p
            id="withdraw-confirm-error"
            role="alert"
            className="text-sm text-red-600 dark:text-red-400"
          >
            {confirmError.join(" ")}
          </p>
        )}
      </div>

      <FormField
        id="withdraw-password"
        label="비밀번호 확인"
        hint="본인 확인을 위해 현재 비밀번호를 입력하세요."
        error={state?.errors?.password}
      >
        {(control) => (
          <input
            {...control}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={INPUT_CLASS}
          />
        )}
      </FormField>

      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "처리 중…" : "회원 탈퇴"}
      </button>
    </form>
  );
}
