// 게임 화면의 순수 뷰모델 — 엔진 상태(RunState)를 받아 HUD 요약과 상황별
// 액션 버튼 목록을 계산. DOM 의존 0 → 단위 테스트 가능(렌더는 game.tsx가 담당).
import { computeScore } from "@/lib/game/rogue/score";
import {
  effectiveAtk,
  effectiveDef,
  type Action,
  type Phase,
  type RunState,
} from "@/lib/game/rogue/types";

export type ActionButton = {
  key: string; // 숫자 단축키("1".."9")
  label: string;
  action: Action;
  primary?: boolean; // Enter로 실행되는 기본 행동
};

const PHASE_LABEL: Record<Phase, string> = {
  explore: "탐험",
  combat: "전투",
  shop: "상점",
  cleared: "층 클리어",
  dead: "사망",
};

export type HudView = {
  hp: number;
  maxHp: number;
  hpPct: number; // 0..100
  depth: number;
  gold: number;
  level: number;
  xp: number;
  atk: number;
  def: number;
  weapon: string;
  armor: string;
  potions: number;
  kills: number;
  score: number;
  phase: Phase;
  phaseLabel: string;
  enemy: { name: string; hp: number; maxHp: number; hpPct: number } | null;
};

export function hudView(s: RunState): HudView {
  const p = s.player;
  const hpPct = Math.max(0, Math.round((p.hp / p.maxHp) * 100));
  return {
    hp: Math.max(0, p.hp),
    maxHp: p.maxHp,
    hpPct,
    depth: s.depth,
    gold: p.gold,
    level: p.level,
    xp: p.xp,
    atk: effectiveAtk(p),
    def: effectiveDef(p),
    weapon: p.weapon?.name ?? "맨손",
    armor: p.armor?.name ?? "평상복",
    potions: p.potions.length,
    kills: s.kills,
    score: computeScore(s),
    phase: s.phase,
    phaseLabel: PHASE_LABEL[s.phase],
    enemy: s.enemy
      ? {
          name: s.enemy.name,
          hp: Math.max(0, s.enemy.hp),
          maxHp: s.enemy.maxHp,
          hpPct: Math.max(0, Math.round((s.enemy.hp / s.enemy.maxHp) * 100)),
        }
      : null,
  };
}

// 상황별 액션 버튼(숫자 단축키 1부터 순서대로). dead는 빈 목록(재시작은 셸이 처리).
export function actionsFor(s: RunState): ActionButton[] {
  const hasPotion = s.player.potions.length > 0;
  switch (s.phase) {
    case "explore": {
      const out: ActionButton[] = [
        { key: "1", label: "전진", action: { type: "advance" }, primary: true },
      ];
      if (hasPotion)
        out.push({
          key: "2",
          label: "물약 사용",
          action: { type: "usePotion" },
        });
      return out;
    }
    case "combat": {
      const out: ActionButton[] = [
        { key: "1", label: "공격", action: { type: "attack" }, primary: true },
      ];
      out.push({ key: "2", label: "도망", action: { type: "flee" } });
      if (hasPotion)
        out.push({
          key: "3",
          label: "물약 사용",
          action: { type: "usePotion" },
        });
      return out;
    }
    case "shop": {
      const out: ActionButton[] = s.shop.map((item, index) => ({
        key: String(index + 1),
        label: `구매: ${item.name} (${item.price} G)`,
        action: { type: "buy", index } as Action,
      }));
      out.push({
        key: String(out.length + 1),
        label: "상점 나가기",
        action: { type: "leaveShop" },
        primary: true,
      });
      return out;
    }
    case "cleared":
      return [
        {
          key: "1",
          label: "더 깊이 내려가기",
          action: { type: "descend" },
          primary: true,
        },
      ];
    case "dead":
      return [];
  }
}
