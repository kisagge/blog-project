"use client";
import { useEffect, useRef, useState } from "react";
import LoginRequiredModal from "../login-required-modal";
import { toggleCommentReactionAction } from "./comment-actions";
import {
  REACTION_EMOJIS,
  REACTION_LABELS,
  type ReactionSummary,
} from "@/lib/reactions";

type State = Record<string, { count: number; reacted: boolean }>;

function toState(initial: ReactionSummary[]): State {
  const s: State = {};
  for (const e of REACTION_EMOJIS) s[e] = { count: 0, reacted: false };
  for (const r of initial) s[r.emoji] = { count: r.count, reacted: r.reacted };
  return s;
}
const serialize = (rs: ReactionSummary[]) =>
  rs.map((r) => `${r.emoji}:${r.count}:${r.reacted ? 1 : 0}`).join(",");

export default function CommentReactions({
  commentId,
  feedId,
  slug,
  initialReactions,
  canParticipate,
}: {
  commentId: string;
  feedId: string;
  slug: string;
  initialReactions: ReactionSummary[];
  canParticipate: boolean;
}) {
  const [state, setState] = useState<State>(() => toState(initialReactions));
  const [pickerOpen, setPickerOpen] = useState(false);
  const modal = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 서버 truth(initialReactions)가 SSE로 바뀌면 렌더 중 카운트 동기화(effect-setState 회피).
  // reacted(내 반응)는 낙관 상태로 유지 — 타인 반응이 내 토글을 덮어쓰지 않게.
  const [syncedKey, setSyncedKey] = useState(() => serialize(initialReactions));
  const key = serialize(initialReactions);
  if (key !== syncedKey) {
    setSyncedKey(key);
    const incoming = toState(initialReactions);
    setState((prev) => {
      const next: State = {};
      for (const e of REACTION_EMOJIS)
        next[e] = { count: incoming[e].count, reacted: prev[e].reacted };
      return next;
    });
  }

  // 디바운스(이모지별): 연타를 최종 상태 1요청으로 합침. committed=서버에 반영된 내 상태.
  const committed = useRef<Record<string, boolean>>(
    Object.fromEntries(REACTION_EMOJIS.map((e) => [e, false])),
  );
  const timers = useRef<Record<string, ReturnType<typeof setTimeout> | null>>(
    {},
  );
  useEffect(() => {
    const t = timers.current;
    const committedInit = committed.current;
    for (const r of initialReactions) committedInit[r.emoji] = r.reacted;
    return () => {
      for (const id of Object.values(t)) if (id) clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 피커 열림: 첫 항목 포커스 + Esc 닫기(트리거로 복귀) + 바깥 클릭 닫기.
  useEffect(() => {
    if (!pickerOpen) return;
    const first = menuRef.current?.querySelector<HTMLButtonElement>("button");
    first?.focus();
    function onKey(e: KeyboardEvent) {
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

  function toggle(emoji: string) {
    if (!canParticipate) {
      modal.current?.showModal();
      return;
    }
    const next = !state[emoji].reacted;
    setState((p) => ({
      ...p,
      [emoji]: { reacted: next, count: p[emoji].count + (next ? 1 : -1) },
    }));
    const t = timers.current[emoji];
    if (t) clearTimeout(t);
    timers.current[emoji] = setTimeout(() => {
      if (next === committed.current[emoji]) return; // 짝수 연타 → 호출 없음
      committed.current[emoji] = next;
      void (async () => {
        try {
          await toggleCommentReactionAction(commentId, feedId, slug, emoji);
        } catch {
          // 429(미들웨어가 액션 전 반환) 등 실패 → 낙관 롤백(follow 버튼 패턴).
          committed.current[emoji] = !next;
          setState((p) =>
            // 인플라이트 중 사용자가 다시 토글했으면(reacted!==next) 최신 의도 보존.
            p[emoji].reacted === next
              ? {
                  ...p,
                  [emoji]: {
                    reacted: !next,
                    count: p[emoji].count + (next ? -1 : 1),
                  },
                }
              : p,
          );
        }
      })();
    }, 500);
  }

  const visible = REACTION_EMOJIS.filter((e) => state[e].count > 0);

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {visible.map((emoji) => {
        const { count, reacted } = state[emoji];
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
            if (!canParticipate) {
              modal.current?.showModal();
              return;
            }
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
            className="bg-background absolute left-0 z-10 mt-1 flex gap-1 rounded-lg border border-black/15 p-1 shadow-lg dark:border-white/20"
          >
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                role="menuitemcheckbox"
                aria-label={REACTION_LABELS[emoji]}
                aria-checked={state[emoji].reacted}
                onClick={() => {
                  toggle(emoji);
                  setPickerOpen(false);
                  triggerRef.current?.focus();
                }}
                className={`rounded px-1.5 py-0.5 text-base hover:bg-black/[.06] dark:hover:bg-white/[.1] ${
                  state[emoji].reacted
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
      <LoginRequiredModal ref={modal} />
    </div>
  );
}
