"use client";
import { useActionState } from "react";
import {
  searchDfCharactersAction,
  addDfCharacterAction,
  type DfSearchState,
} from "./actions";
import type { DfServer } from "@/lib/neople";

const inputCls =
  "rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20";

export default function DfManager({ servers }: { servers: DfServer[] }) {
  const [state, action, pending] = useActionState<DfSearchState, FormData>(
    searchDfCharactersAction,
    undefined,
  );
  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <select
            name="serverId"
            aria-label="서버 선택"
            defaultValue=""
            className={`${inputCls} appearance-none pr-9`}
          >
            <option value="" disabled>
              서버 선택
            </option>
            {servers.map((s) => (
              <option key={s.serverId} value={s.serverId}>
                {s.serverName}
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-zinc-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
        <input
          name="characterName"
          aria-label="캐릭터명"
          placeholder="캐릭터명"
          className={inputCls}
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-black/15 px-3 py-2 text-sm dark:border-white/20"
        >
          {pending ? "검색 중…" : "검색"}
        </button>
      </form>

      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      {state?.rows && state.rows.length > 0 && (
        <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.1]">
          {state.rows.map((r) => (
            <li
              key={r.characterId}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">
                {r.characterName} · Lv{r.level} {r.jobGrowName}
                {typeof r.fame === "number" &&
                  ` · 명성 ${r.fame.toLocaleString()}`}
              </span>
              <form action={addDfCharacterAction}>
                <input type="hidden" name="serverId" value={r.serverId} />
                <input type="hidden" name="characterId" value={r.characterId} />
                <input
                  type="hidden"
                  name="characterName"
                  value={r.characterName}
                />
                <button className="shrink-0 rounded border border-black/15 px-2 py-1 dark:border-white/20">
                  추가
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
