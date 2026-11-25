"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLoginPrompt } from "./login-prompt";
import { useOptimisticToggles } from "@/app/ui/use-optimistic-toggle";
import {
  REACTION_EMOJIS,
  REACTION_LABELS,
  type ReactionEmoji as Emoji,
  type ReactionSummary,
} from "@/lib/reactions";

const countsOf = (rs: ReactionSummary[]) => {
  const c = Object.fromEntries(REACTION_EMOJIS.map((e) => [e, 0])) as Record<
    Emoji,
    number
  >;
  for (const r of rs) c[r.emoji as Emoji] = r.count;
  return c;
};
const reactedOf = (rs: ReactionSummary[]) => {
  const m = Object.fromEntries(
    REACTION_EMOJIS.map((e) => [e, false]),
  ) as Record<Emoji, boolean>;
  for (const r of rs) m[r.emoji as Emoji] = r.reacted;
  return m;
};
const serialize = (rs: ReactionSummary[]) =>
  rs.map((r) => `${r.emoji}:${r.count}`).join(",");

// 이모지 반응 칩 + 추가 피커(글·댓글 공용).
// reactions: 서버 truth. 바뀌면(실시간) 카운트만 따라가고, 내 반응(reacted)은 낙관 상태로 유지 —
// 다른 사람의 반응이 내 토글을 덮어쓰지 않게. resyncToken이 바뀌면(재접속) 대기 중이 아닐 때 내 반응도 서버 값으로.
export default function ReactionBar({
  reactions,
  commit,
  canParticipate,
  resyncToken = 0,
}: {
  reactions: ReactionSummary[];
  commit: (emoji: string) => Promise<unknown>;
  canParticipate: boolean;
  resyncToken?: number;
}) {
  const promptLogin = useLoginPrompt();
  const [counts, setCounts] = useState(() => countsOf(reactions));
  const toggles = useOptimisticToggles(
    reactedOf(reactions),
    (emoji) => commit(emoji),
    (emoji, failed) =>
      setCounts((c) => ({ ...c, [emoji]: c[emoji] + (failed ? -1 : 1) })),
  );

  // 서버 truth 변경을 렌더 중 반영(effect-setState 회피).
  const [synced, setSynced] = useState({
    key: serialize(reactions),
    token: resyncToken,
  });
  const key = serialize(reactions);
  if (key !== synced.key || resyncToken !== synced.token) {
    setSynced({ key, token: resyncToken });
    setCounts(countsOf(reactions));
    if (resyncToken !== synced.token && !toggles.pending())
      toggles.reset(reactedOf(reactions));
  }

  const [pickerOpen, setPickerOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 피커 열림: 첫 항목 포커스 + Esc 닫기(트리거로 복귀) + 바깥 클릭 닫기.
  useEffect(() => {
    if (!pickerOpen) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        setPickerOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onDown(e: MouseEvent) {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      )
        setPickerOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [pickerOpen]);

  // ARIA menu: 방향키(끝에서 순환)·Home/End로 항목 간 이동.
  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const items = [
      ...(menuRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []),
    ];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const last = items.length - 1;
    const next =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? i >= last
          ? 0
          : i + 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? i <= 0
            ? last
            : i - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    items[next]?.focus();
  }

  function toggle(emoji: Emoji) {
    if (!canParticipate) return promptLogin();
    const next = toggles.toggle(emoji);
    setCounts((c) => ({ ...c, [emoji]: c[emoji] + (next ? 1 : -1) }));
  }

  const visible = REACTION_EMOJIS.filter((e) => counts[e] > 0);

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {visible.map((emoji) => {
        const count = counts[emoji];
        const reacted = toggles.state[emoji];
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => toggle(emoji)}
            aria-pressed={reacted}
            aria-label={`${REACTION_LABELS[emoji]} 반응 ${count}개`}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
              reacted
                ? "border-amber-400 bg-amber-100 text-amber-800 dark:border-amber-400/50 dark:bg-amber-400/15 dark:text-amber-300"
                : "border-black/10 hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06]"
            }`}
          >
            <span aria-hidden>{emoji}</span>
            {count}
          </button>
        );
      })}

      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          aria-label="이모지 반응 추가"
          aria-haspopup="menu"
          aria-expanded={pickerOpen}
          onClick={() => {
            if (!canParticipate) return promptLogin();
            setPickerOpen((v) => !v);
          }}
          className="inline-flex items-center rounded-full border border-black/10 px-2 py-0.5 text-xs text-zinc-500 hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06]"
        >
          <span aria-hidden>＋</span>
        </button>
        {pickerOpen && (
          <div
            ref={menuRef}
            role="menu"
            aria-label="이모지 선택"
            onKeyDown={onMenuKeyDown}
            className="bg-background absolute left-0 z-10 mt-1 flex gap-1 rounded-lg border border-black/15 p-1 shadow-lg dark:border-white/20"
          >
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                role="menuitemcheckbox"
                aria-label={REACTION_LABELS[emoji]}
                aria-checked={toggles.state[emoji]}
                onClick={() => {
                  toggle(emoji);
                  setPickerOpen(false);
                  triggerRef.current?.focus();
                }}
                className={`rounded px-1.5 py-0.5 text-base hover:bg-black/[.06] dark:hover:bg-white/[.1] ${
                  toggles.state[emoji]
                    ? "bg-amber-100 dark:bg-amber-400/15"
                    : ""
                }`}
              >
                <span aria-hidden>{emoji}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
