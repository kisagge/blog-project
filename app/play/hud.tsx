"use client";
// 게임 HUD(시맨틱·키보드 가능). 라운드·페이즈·선택 유닛 패널·행동 버튼.
import { CLASS_KO } from "./controller";
import { statOf, type Faction, type Unit } from "@/lib/game/srpg/types";

export default function Hud({
  round,
  phase,
  selected,
  canWait,
  onWait,
  onEndTurn,
}: {
  round: number;
  phase: Faction;
  selected: Unit | null;
  canWait: boolean;
  onWait: () => void;
  onEndTurn: () => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm">
        <span className="font-semibold">라운드 {round}</span>
        <span className="mx-2 text-zinc-400">·</span>
        <span
          className={
            phase === "dawn"
              ? "text-blue-600 dark:text-blue-400"
              : "text-red-600 dark:text-red-400"
          }
        >
          {phase === "dawn" ? "여명단(내) 차례" : "잿더미단 차례"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {selected ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            <span className="font-medium">{CLASS_KO[selected.cls]}</span> · HP{" "}
            {selected.hp}/{statOf(selected).maxHp} · ATK {statOf(selected).atk}{" "}
            / DEF {statOf(selected).def} · 이동 {statOf(selected).mov} · 사거리{" "}
            {statOf(selected).rng}
          </p>
        ) : (
          <p className="text-sm text-zinc-400">유닛을 선택하세요</p>
        )}

        <button
          type="button"
          onClick={onWait}
          disabled={!canWait}
          className="rounded-full border border-black/15 px-3 py-1 text-sm hover:bg-black/[.04] disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/[.06]"
        >
          대기
        </button>
        <button
          type="button"
          onClick={onEndTurn}
          disabled={phase !== "dawn"}
          className="bg-foreground text-background rounded-full px-3 py-1 text-sm font-medium disabled:opacity-40"
        >
          턴 종료
        </button>
      </div>
    </div>
  );
}
