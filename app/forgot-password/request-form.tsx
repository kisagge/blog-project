"use client";
import { useActionState } from "react";
import Link from "next/link";
import { requestCode, type RequestState } from "./actions";

const inputCls =
  "rounded border border-black/15 bg-transparent px-3 py-2 dark:border-white/20";

export default function RequestForm() {
  const [state, action, pending] = useActionState<RequestState, FormData>(
    requestCode,
    undefined,
  );
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className={inputCls}
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-foreground text-background rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "전송 중…" : "인증 코드 전송"}
      </button>
      <p className="text-sm text-zinc-500">
        <Link href="/signin" className="underline">
          로그인으로 돌아가기
        </Link>
      </p>
    </form>
  );
}
