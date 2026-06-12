"use client";
import { useActionState, useEffect, useState } from "react";
import { verifyCode, resendCode, type VerifyState } from "../actions";

const inputCls =
  "rounded border border-black/15 bg-transparent px-3 py-2 dark:border-white/20";

function useCountdown(expiresAtMs: number) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, expiresAtMs - Date.now()),
  );
  useEffect(() => {
    const id = setInterval(
      () => setRemaining(Math.max(0, expiresAtMs - Date.now())),
      1000,
    );
    return () => clearInterval(id);
  }, [expiresAtMs]);
  return remaining;
}

function format(ms: number) {
  const s = Math.ceil(ms / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function VerifyForm({ expiresAt }: { expiresAt: string }) {
  const [state, action, pending] = useActionState<VerifyState, FormData>(
    verifyCode,
    undefined,
  );
  const expiresAtMs = new Date(expiresAt).getTime();
  const remaining = useCountdown(expiresAtMs);
  const expired = remaining <= 0;

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label htmlFor="code" className="text-sm font-medium">
              인증 코드
            </label>
            <span
              className={`text-sm tabular-nums ${expired ? "text-red-600" : "text-zinc-500"}`}
            >
              {expired ? "만료됨" : format(remaining)}
            </span>
          </div>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            className={`${inputCls} text-center text-lg tracking-[0.4em]`}
          />
        </div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending || expired}
          className="bg-foreground text-background rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "확인 중…" : "확인"}
        </button>
      </form>
      <form action={resendCode}>
        <button
          type="submit"
          className="w-full text-sm text-zinc-500 underline"
        >
          코드 재전송
        </button>
      </form>
    </div>
  );
}
