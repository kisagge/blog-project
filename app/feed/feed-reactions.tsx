"use client";
import { useEffect, useRef, useState } from "react";
import LoginRequiredModal from "./login-required-modal";
import { useFeedEvent } from "./feed-events-context";
import {
  getFeedReactionSummaryAction,
  toggleFeedReactionAction,
} from "./comments/comment-actions";
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

// 글(피드) 이모지 리액션 — 댓글 리액션 UI + 좋아요 버튼의 SSE 자체 구독을 결합한 leaf.
export default function FeedReactions({
  feedId,
  slug,
  initialReactions,
  canParticipate,
}: {
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

  // 디바운스(이모지별): 연타를 최종 상태 1요청으로 합침. committed=서버에 반영된 내 상태.
  const committed = useRef<Record<string, boolean>>(
    Object.fromEntries(REACTION_EMOJIS.map((e) => [e, false])),
  );
  const timers = useRef<Record<string, ReturnType<typeof setTimeout> | null>>(
    {},
  );
  const pending = useRef(0); // 인플라이트 토글 수(SSE resync 가드)

  useEffect(() => {
    const t = timers.current;
    const committedInit = committed.current;
    for (const r of initialReactions) committedInit[r.emoji] = r.reacted;
    return () => {
      for (const id of Object.values(t)) if (id) clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 실시간(SSE, 피드 연결 공유): 다른 뷰어 반응으로 바뀐 서버 truth로 카운트만 갱신.
  // reacted(내 반응)는 뷰어별이라 SSE로 바꾸지 않음(낙관 유지). 재접속 시 서버 truth로 재동기화.
  useFeedEvent((ev) => {
    if (ev.kind === "feedReaction") {
      setState((p) => ({
        ...p,
        [ev.emoji]: {
          count: ev.count,
          reacted: p[ev.emoji]?.reacted ?? false,
        },
      }));
      return;
    }
    if (ev.kind === "resync") {
      // 대기 토글이 있으면 건너뜀: 그 상태는 사용자 의도(낙관)가 소유(좋아요 패턴).
      if (pending.current > 0) return;
      void getFeedReactionSummaryAction(feedId).then((rs) => {
        const next = toState(rs);
        setState(next);
        for (const e of REACTION_EMOJIS) committed.current[e] = next[e].reacted;
      });
    }
  });

  // 피커 열림: 첫 항목 포커스 + Esc 닫기(트리거 복귀) + 바깥 클릭 닫기.
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
      pending.current++;
      void (async () => {
        try {
          await toggleFeedReactionAction(feedId, slug, emoji);
        } catch {
          // 429(미들웨어가 액션 전 반환) 등 실패 → 낙관 롤백(좋아요·follow 패턴).
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
        } finally {
          pending.current--;
        }
      })();
    }, 500);
  }

  const visible = REACTION_EMOJIS.filter((e) => state[e].count > 0);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {visible.map((emoji) => {
        const { count, reacted } = state[emoji];
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => toggle(emoji)}
            aria-pressed={reacted}
            aria-label={`${REACTION_LABELS[emoji]} 반응 ${count}개`}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm ${
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
          className="inline-flex items-center rounded-full border border-black/10 px-2.5 py-1 text-sm text-zinc-500 hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06]"
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
                className={`rounded px-1.5 py-0.5 text-lg hover:bg-black/[.06] dark:hover:bg-white/[.1] ${
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
