"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { newRun, reduce } from "@/lib/game/rogue/run";
import type { Action, RunState } from "@/lib/game/rogue/types";
import { submitScoreAction } from "./actions";
import { actionsFor, hudView, type ActionButton } from "./view";

type SubmitState = "idle" | "saving" | "saved" | "skipped" | "error";

// 양의 정수 시드 생성(이벤트 핸들러 내에서만 호출 — SSR 하이드레이션 무관).
function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000);
}

const MAX_LOG = 40;

export default function Game({ canRecord }: { canRecord: boolean }) {
  const router = useRouter();
  const [seed, setSeed] = useState<number | null>(null);
  const [state, setState] = useState<RunState | null>(null);
  const [seedInput, setSeedInput] = useState("");
  const [submit, setSubmit] = useState<SubmitState>("idle");
  const submittedRef = useRef(false);

  const dispatch = useCallback(
    (a: Action) => setState((s) => (s ? reduce(s, a) : s)),
    [],
  );

  const restart = useCallback((s: number) => {
    submittedRef.current = false;
    setSubmit("idle");
    setSeed(s);
    setState(newRun(s));
  }, []);

  // 시드는 클라이언트 마운트 후 1회 생성(서버 랜덤은 비순수·하이드레이션 불일치).
  useEffect(() => {
    const s = randomSeed();
    /* eslint-disable react-hooks/set-state-in-effect */
    setSeed(s);
    setState(newRun(s));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const actions = state ? actionsFor(state) : [];
  const dead = state?.phase === "dead";

  // 숫자 단축키 + Enter(기본 행동). 최신 액션 목록을 ref로 참조.
  const actionsRef = useRef<ActionButton[]>(actions);
  useEffect(() => {
    actionsRef.current = actions;
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const list = actionsRef.current;
      if (e.key === "Enter") {
        const primary = list.find((b) => b.primary) ?? list[0];
        if (primary) {
          e.preventDefault();
          dispatch(primary.action);
        }
        return;
      }
      const hit = list.find((b) => b.key === e.key);
      if (hit) {
        e.preventDefault();
        dispatch(hit.action);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch]);

  // 로그 새 줄이 추가되면 맨 아래로 스크롤.
  const logRef = useRef<HTMLOListElement>(null);
  const log = state?.log;
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  // 런 종료(사망) 시 점수 1회 제출 → 리더보드 갱신.
  const phase = state?.phase;
  useEffect(() => {
    if (phase !== "dead" || submittedRef.current) return;
    submittedRef.current = true;
    if (!canRecord || !state || seed === null) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setSubmit("skipped");
      return;
    }
    setSubmit("saving");
    submitScoreAction({
      seed,
      depth: state.depth,
      kills: state.kills,
      gold: state.player.gold,
    })
      .then((r) => {
        if ("ok" in r) {
          setSubmit("saved");
          router.refresh();
        } else if ("skipped" in r) {
          setSubmit("skipped");
        } else {
          setSubmit("error");
        }
      })
      .catch(() => setSubmit("error"));
  }, [phase, canRecord, seed, state, router]);

  if (!state) {
    return <p className="text-sm text-zinc-500">던전을 준비하는 중…</p>;
  }

  const hud = hudView(state);
  const lines = state.log.slice(-MAX_LOG);
  const firstShown = state.log.length - lines.length;

  return (
    <div className="flex flex-col gap-6">
      {/* HUD */}
      <section
        aria-label="상태"
        className="rounded-lg border border-black/[.08] p-4 dark:border-white/[.145]"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-sm font-semibold">
            {hud.depth}층 · {hud.phaseLabel}
          </h2>
          <p className="text-sm text-zinc-500">
            점수{" "}
            <span className="text-foreground font-semibold">{hud.score}</span> ·
            처치 {hud.kills}
          </p>
        </div>

        <HpBar label="HP" cur={hud.hp} max={hud.maxHp} pct={hud.hpPct} />

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
          <Stat term="공격" value={String(hud.atk)} />
          <Stat term="방어" value={String(hud.def)} />
          <Stat term="레벨" value={`${hud.level} (XP ${hud.xp})`} />
          <Stat term="골드" value={String(hud.gold)} />
          <Stat term="무기" value={hud.weapon} />
          <Stat term="방어구" value={hud.armor} />
          <Stat term="물약" value={`${hud.potions}개`} />
          <Stat term="시드" value={String(seed)} />
        </dl>

        {hud.enemy && (
          <div className="mt-3 rounded-md bg-red-500/5 p-3">
            <HpBar
              label={`적 · ${hud.enemy.name}`}
              cur={hud.enemy.hp}
              max={hud.enemy.maxHp}
              pct={hud.enemy.hpPct}
              danger
            />
          </div>
        )}
      </section>

      {/* 로그 */}
      <section aria-label="기록">
        <ol
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-label="모험 기록"
          className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-lg border border-black/[.08] p-4 text-sm leading-relaxed dark:border-white/[.145]"
        >
          {lines.map((line, i) => (
            <li
              key={firstShown + i}
              className={
                i === lines.length - 1 ? "text-foreground" : "text-zinc-500"
              }
            >
              {line}
            </li>
          ))}
        </ol>
      </section>

      {/* 사망 배너 또는 액션 */}
      {dead ? (
        <section
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/5 p-5 text-center"
        >
          <h2 className="text-lg font-semibold">심연에 쓰러졌다</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {hud.depth}층까지 도달 · {hud.kills}처치 · 최종 점수{" "}
            <span className="text-foreground font-semibold">{hud.score}</span>
          </p>
          <p className="mt-2 text-xs text-zinc-500" aria-live="polite">
            {submit === "saving" && "기록 저장 중…"}
            {submit === "saved" && "리더보드에 기록되었습니다."}
            {submit === "skipped" &&
              (canRecord
                ? "기록되지 않았습니다."
                : "관리자 플레이는 리더보드에 기록되지 않습니다.")}
            {submit === "error" && "기록 저장에 실패했습니다."}
          </p>
          <button
            type="button"
            onClick={() => restart(randomSeed())}
            className="bg-foreground text-background mt-4 rounded-full px-5 py-2.5 text-sm font-medium"
          >
            새 게임
          </button>
        </section>
      ) : (
        <section aria-label="행동" className="flex flex-wrap gap-2">
          {actions.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => dispatch(b.action)}
              className={
                b.primary
                  ? "bg-foreground text-background rounded-full px-4 py-2 text-sm font-medium"
                  : "rounded-full border border-black/15 px-4 py-2 text-sm font-medium dark:border-white/20"
              }
            >
              <span aria-hidden className="mr-1 opacity-60">
                {b.key}
              </span>
              {b.label}
            </button>
          ))}
        </section>
      )}

      {/* 시드 재도전 / 키보드 안내 */}
      <section
        aria-label="새 게임"
        className="flex flex-col gap-3 border-t border-black/[.06] pt-4 text-sm dark:border-white/[.1]"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(seedInput.trim());
            if (Number.isFinite(n) && seedInput.trim() !== "") restart(n >>> 0);
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="seed-input" className="text-xs text-zinc-500">
              시드로 도전(같은 시드 = 같은 던전)
            </label>
            <input
              id="seed-input"
              inputMode="numeric"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              placeholder="예: 12345"
              className="w-40 rounded-md border border-black/15 bg-transparent px-3 py-1.5 dark:border-white/20"
            />
          </div>
          <button
            type="submit"
            className="rounded-full border border-black/15 px-4 py-2 font-medium dark:border-white/20"
          >
            이 시드로 시작
          </button>
          <button
            type="button"
            onClick={() => restart(randomSeed())}
            className="rounded-full border border-black/15 px-4 py-2 font-medium dark:border-white/20"
          >
            랜덤 새 게임
          </button>
        </form>
        <p className="text-xs text-zinc-400">
          키보드: 숫자키로 행동 선택, Enter로 기본 행동.
        </p>
      </section>
    </div>
  );
}

function HpBar({
  label,
  cur,
  max,
  pct,
  danger = false,
}: {
  label: string;
  cur: number;
  max: number;
  pct: number;
  danger?: boolean;
}) {
  const color =
    pct > 50 ? "bg-emerald-500" : pct > 25 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="mt-2">
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className={danger ? "font-medium" : "text-zinc-500"}>
          {label}
        </span>
        <span className="tabular-nums">
          {cur} / {max}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={cur}
        aria-valuemin={0}
        aria-valuemax={max}
        className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/15"
      >
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Stat({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-zinc-500">{term}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
