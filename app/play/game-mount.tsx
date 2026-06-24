"use client";
// 게임 호스트: 컨트롤러 상태 + 마우스/키보드/호버 입력 + 맵 선택 + HUD + a11y + 결과.
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  attackTiles,
  cursorInfo,
  endTurn,
  firstDawnCoord,
  moveTiles,
  newGame,
  previewText,
  resultText,
  selectAt,
  selectedUnit,
  unitSummaries,
  waitSelected,
  type UiState,
} from "./controller";
import Hud from "./hud";
import { MAPS, mapById } from "@/lib/game/srpg/maps";
import type { Coord } from "@/lib/game/srpg/types";

const SceneCanvas = dynamic(() => import("./scene-canvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
      보드 불러오는 중…
    </div>
  ),
});

const INITIAL = MAPS[0];
const INITIAL_UI = newGame(INITIAL.raw);

export default function GameMount() {
  const [mapId, setMapId] = useState(INITIAL.id);
  const [ui, setUi] = useState<UiState>(INITIAL_UI);
  const [cursor, setCursor] = useState<Coord>(() =>
    firstDawnCoord(INITIAL_UI.game),
  );
  const [announce, setAnnounce] = useState("유닛을 선택해 전투를 시작하세요.");
  const restartRef = useRef<HTMLButtonElement>(null);

  const finished = ui.game.result !== "ongoing";
  const sel = selectedUnit(ui);
  const canAct = !!sel && !sel.acted && ui.game.phase === "dawn";
  // 커서가 공격 대상이면 예상 피해(없으면 undefined).
  const preview = canAct
    ? (previewText(ui.game, sel.id, cursor) ?? undefined)
    : undefined;

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

  function startMap(id: string) {
    const entry = mapById(id);
    const g = newGame(entry.raw);
    setMapId(id);
    setUi(g);
    setCursor(firstDawnCoord(g.game));
    setAnnounce(`${entry.name} — 새 전투를 시작합니다.`);
  }
  const onRestart = () => startMap(mapId);

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
      const info = cursorInfo(ui.game, next);
      const pv = canAct ? previewText(ui.game, sel.id, next) : null;
      setAnnounce(pv ? `${info} — ${pv}` : info);
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
      <div
        role="group"
        aria-label="맵 선택"
        className="mb-3 flex flex-wrap items-center gap-2 text-sm"
      >
        <span className="text-zinc-400">맵</span>
        {MAPS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => startMap(m.id)}
            aria-pressed={m.id === mapId}
            className={`rounded-full border px-3 py-1 ${
              m.id === mapId
                ? "border-blue-400 bg-blue-100 font-medium text-blue-800 dark:border-blue-400/50 dark:bg-blue-400/15 dark:text-blue-300"
                : "border-black/15 text-zinc-600 hover:bg-black/[.04] dark:border-white/20 dark:text-zinc-300 dark:hover:bg-white/[.06]"
            }`}
          >
            {m.name}
          </button>
        ))}
      </div>

      <Hud
        round={ui.game.round}
        phase={ui.game.phase}
        selected={sel}
        canWait={canAct}
        preview={preview}
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
          onHover={setCursor}
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

      <p
        role="status"
        aria-live="polite"
        className="mt-2 min-h-5 text-sm text-zinc-500"
      >
        {announce}
      </p>

      <ul className="sr-only">
        {unitSummaries(ui.game).map((s) => (
          <li key={s.id}>
            {s.label} HP {s.hp}/{s.maxHp}, 위치 ({s.col},{s.row})
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-zinc-400">
        조작: 마우스 클릭/호버 또는 방향키+Enter로 유닛 선택 → 파란 칸 이동 →
        빨간 칸의 적 공격(예상 피해 표시). Esc 선택 해제, E 턴 종료.
      </p>
    </div>
  );
}
