"use client";
// 게임 호스트: 컨트롤러 상태 + 마우스/키보드 입력 + HUD + aria-live + SR 보드 미러 + 결과.
// three 캔버스는 ssr:false 지연 로드(코드베이스 dynamic 패턴).
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  attackTiles,
  cursorInfo,
  endTurn,
  moveTiles,
  newGame,
  resultText,
  selectAt,
  selectedUnit,
  unitSummaries,
  waitSelected,
  type UiState,
} from "./controller";
import Hud from "./hud";
import type { Coord } from "@/lib/game/srpg/types";

const SceneCanvas = dynamic(() => import("./scene-canvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
      보드 불러오는 중…
    </div>
  ),
});

const START_CURSOR: Coord = { col: 1, row: 8 }; // 여명단 전사 시작칸(skirmish-01)

export default function GameMount() {
  const [ui, setUi] = useState<UiState>(newGame);
  const [cursor, setCursor] = useState<Coord>(START_CURSOR);
  const [announce, setAnnounce] = useState("유닛을 선택해 전투를 시작하세요.");
  const restartRef = useRef<HTMLButtonElement>(null);

  const finished = ui.game.result !== "ongoing";
  const sel = selectedUnit(ui);

  // 결과가 뜨면 다시하기로 포커스 이동(a11y).
  useEffect(() => {
    if (finished) restartRef.current?.focus();
  }, [finished]);

  function apply(step: { ui: UiState; announce?: string }) {
    setUi(step.ui);
    if (step.announce) setAnnounce(step.announce);
  }

  const pick = (coord: Coord) => apply(selectAt(ui, coord));
  const onWait = () => apply(waitSelected(ui));
  const onEndTurn = () => apply(endTurn(ui));
  const onRestart = () => {
    setUi(newGame());
    setCursor(START_CURSOR);
    setAnnounce("새 전투를 시작합니다.");
  };

  function onKeyDown(e: React.KeyboardEvent) {
    if (finished) return;
    const { cols, rows } = ui.game.map;
    const move = (dc: number, dr: number) => {
      e.preventDefault();
      const next = {
        col: Math.min(cols - 1, Math.max(0, cursor.col + dc)),
        row: Math.min(rows - 1, Math.max(0, cursor.row + dr)),
      };
      setCursor(next);
      setAnnounce(cursorInfo(ui.game, next));
    };
    switch (e.key) {
      case "ArrowUp":
        return move(0, -1);
      case "ArrowDown":
        return move(0, 1);
      case "ArrowLeft":
        return move(-1, 0);
      case "ArrowRight":
        return move(1, 0);
      case "Enter":
      case " ":
        e.preventDefault();
        return pick(cursor);
      case "Escape":
        setUi({ game: ui.game, selectedId: null });
        setAnnounce("선택 해제");
        return;
      case "e":
      case "E":
        e.preventDefault();
        return onEndTurn();
    }
  }

  return (
    <div>
      <Hud
        round={ui.game.round}
        phase={ui.game.phase}
        selected={sel}
        canWait={!!sel && !sel.acted && ui.game.phase === "dawn"}
        onWait={onWait}
        onEndTurn={onEndTurn}
      />

      <div
        role="application"
        aria-label="전술 전투 보드 — 방향키로 커서 이동, Enter로 선택·이동·공격, Esc 해제, E 턴 종료"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative h-[60vh] min-h-80 w-full overflow-hidden rounded-lg border border-black/[.08] outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-white/[.145]"
      >
        <SceneCanvas
          state={ui.game}
          selectedId={ui.selectedId}
          moveTiles={moveTiles(ui)}
          attackTiles={attackTiles(ui)}
          cursor={cursor}
          onPick={pick}
        />

        {finished && (
          <div
            role="alertdialog"
            aria-label="전투 결과"
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 text-white"
          >
            <p className="text-2xl font-bold">{resultText(ui.game.result)}</p>
            <button
              ref={restartRef}
              type="button"
              onClick={onRestart}
              className="rounded-full bg-white px-5 py-2 text-sm font-medium text-zinc-900"
            >
              다시하기
            </button>
          </div>
        )}
      </div>

      {/* 실시간 안내(모두에게 보이는 상태줄 + 스크린리더) */}
      <p
        role="status"
        aria-live="polite"
        className="mt-2 min-h-5 text-sm text-zinc-500"
      >
        {announce}
      </p>

      {/* 스크린리더 보드 미러: 살아있는 유닛 목록 */}
      <ul className="sr-only">
        {unitSummaries(ui.game).map((s) => (
          <li key={s.id}>
            {s.label} HP {s.hp}/{s.maxHp}, 위치 ({s.col},{s.row})
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-zinc-400">
        조작: 마우스 클릭 또는 방향키+Enter로 유닛 선택 → 파란 칸 이동 → 빨간
        칸의 적 공격. Esc 선택 해제, E 턴 종료.
      </p>
    </div>
  );
}
