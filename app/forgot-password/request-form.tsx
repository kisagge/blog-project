"use client";
import { INPUT_CLASS, PRIMARY_BTN } from "@/lib/ui";
import { useActionState } from "react";
import Link from "next/link";
import { requestCode, type RequestState } from "./actions";
import TurnstileWidget from "@/app/turnstile-widget";

const inputCls = INPUT_CLASS;

export default function RequestForm({ siteKey }: { siteKey?: string }) {
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
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <TurnstileWidget siteKey={siteKey} resetSignal={state} />
      <button
        type="submit"
        disabled={pending}
        className={PRIMARY_BTN}
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
