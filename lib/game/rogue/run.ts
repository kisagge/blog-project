// 단일 진입 리듀서: (state, action) => state. 모든 규칙을 한 곳에서 강제(시드 결정론·불변).
import { attackRoll } from "./combat";
import { isBossStep, floorIntro } from "./dungeon";
import { drawEvent, drawRest, drawTrap } from "./events";
import { makeEnemy } from "./enemy";
import { POTION, randomItem, shopStock } from "./items";
import {
  acquire,
  addGold,
  consumePotion,
  createPlayer,
  damage,
  gainXp,
  heal,
} from "./player";
import { chance, randInt } from "./rng";
import {
  FLEE_CHANCE,
  effectiveAtk,
  effectiveDef,
  type Action,
  type Enemy,
  type RunState,
} from "./types";

export function newRun(seed: number): RunState {
  return {
    seed,
    player: createPlayer(),
    depth: 1,
    step: 0,
    phase: "explore",
    enemy: null,
    shop: [],
    kills: 0,
    log: ["심연 입구에 섰다.", floorIntro(1)],
  };
}

export function reduce(state: RunState, action: Action): RunState {
  switch (action.type) {
    case "advance":
      return state.phase === "explore" ? advance(state) : state;
    case "attack":
      return state.phase === "combat" ? playerAttack(state) : state;
    case "flee":
      return state.phase === "combat" ? flee(state) : state;
    case "usePotion":
      return drinkPotion(state);
    case "buy":
      return state.phase === "shop" ? buy(state, action.index) : state;
    case "leaveShop":
      return state.phase === "shop"
        ? {
            ...state,
            phase: "explore",
            shop: [],
            log: [...state.log, "상점을 떠났다."],
          }
        : state;
    case "descend":
      return state.phase === "cleared" ? descend(state) : state;
  }
}

// ── 걸음 진행: 다음 걸음의 이벤트 해결 ──
function advance(state: RunState): RunState {
  const step = state.step + 1;
  const log = [...state.log];

  if (isBossStep(step)) {
    const e = makeEnemy(state.seed, state.depth, true);
    log.push(`보스 출현 — ${e.value.name}!`);
    return {
      ...state,
      seed: e.seed,
      step,
      phase: "combat",
      enemy: e.value,
      log,
    };
  }

  const ev = drawEvent(state.seed);
  let seed = ev.seed;
  switch (ev.value) {
    case "combat": {
      const e = makeEnemy(seed, state.depth, false);
      log.push(`${e.value.name}이(가) 길을 막았다.`);
      return {
        ...state,
        seed: e.seed,
        step,
        phase: "combat",
        enemy: e.value,
        log,
      };
    }
    case "treasure": {
      const c = chance(seed, 0.5);
      seed = c.seed;
      if (c.value) {
        const g = randInt(seed, state.depth * 3, state.depth * 6);
        log.push(`보물 — 골드 ${g.value} 획득.`);
        return {
          ...state,
          seed: g.seed,
          step,
          player: addGold(state.player, g.value),
          log,
        };
      }
      const it = randomItem(seed, state.depth);
      const a = acquire(state.player, it.value);
      log.push(
        `보물 — ${
          a.equipped
            ? `${it.value.name} 장착!`
            : it.value.kind === "potion"
              ? `${it.value.name} 획득.`
              : `${it.value.name}(쓸모없음) — 매각.`
        }`,
      );
      return { ...state, seed: it.seed, step, player: a.player, log };
    }
    case "shop": {
      const st = shopStock(seed, state.depth);
      log.push("상점을 발견했다.");
      return {
        ...state,
        seed: st.seed,
        step,
        phase: "shop",
        shop: st.value,
        log,
      };
    }
    case "rest": {
      const r = drawRest(seed);
      seed = r.seed;
      if (r.value === "campfire") {
        const amt = state.player.maxHp - state.player.hp;
        log.push(`모닥불을 피웠다 — HP ${amt} 전부 회복.`);
        return {
          ...state,
          seed,
          step,
          player: heal(state.player, state.player.maxHp),
          log,
        };
      }
      if (r.value === "herb") {
        const a = acquire(state.player, POTION);
        log.push("약초 무더기 — 체력 물약을 챙겼다.");
        return { ...state, seed, step, player: a.player, log };
      }
      const amt = Math.round(state.player.maxHp * 0.3);
      log.push(`휴식 — HP ${amt} 회복.`);
      return { ...state, seed, step, player: heal(state.player, amt), log };
    }
    case "trap": {
      const t = drawTrap(seed);
      seed = t.seed;
      if (t.value === "gold") {
        const g = randInt(seed, state.depth * 2, state.depth * 5);
        const lost = Math.min(state.player.gold, g.value);
        log.push(
          lost > 0
            ? `골드 함정! ${lost} 골드를 잃었다.`
            : "골드 함정! 다행히 잃을 골드가 없었다.",
        );
        return {
          ...state,
          seed: g.seed,
          step,
          player: addGold(state.player, -lost),
          log,
        };
      }
      const d = randInt(seed, state.depth * 2, state.depth * 4);
      const player = damage(state.player, d.value);
      const dead = player.hp <= 0;
      log.push(`함정! ${d.value} 피해.${dead ? " 당신은 쓰러졌다…" : ""}`);
      return {
        ...state,
        seed: d.seed,
        step,
        player,
        phase: dead ? "dead" : "explore",
        log,
      };
    }
  }
}

// ── 전투 ──
function playerAttack(state: RunState): RunState {
  const enemy = state.enemy!;
  const a = attackRoll(state.seed, effectiveAtk(state.player), enemy.def, true);
  const log = [
    ...state.log,
    `공격 — ${enemy.name}에게 ${a.dmg} 피해${a.crit ? "(치명타!)" : ""}.`,
  ];
  const eHp = enemy.hp - a.dmg;
  if (eHp <= 0) return defeat({ ...state, seed: a.seed, log }, enemy);
  return enemyTurn({
    ...state,
    seed: a.seed,
    enemy: { ...enemy, hp: eHp },
    log,
  });
}

function defeat(state: RunState, enemy: Enemy): RunState {
  const g = gainXp(addGold(state.player, enemy.gold), enemy.xp);
  const log = [
    ...state.log,
    `${enemy.name} 처치! XP ${enemy.xp} · 골드 ${enemy.gold}.`,
  ];
  if (g.leveled > 0)
    log.push(`레벨 업! Lv.${g.player.level} — 체력이 회복됐다.`);
  if (enemy.boss)
    log.push(`${state.depth}층의 수문장을 물리쳤다. 더 내려갈 수 있다.`);
  return {
    ...state,
    player: g.player,
    enemy: null,
    kills: state.kills + 1,
    phase: enemy.boss ? "cleared" : "explore",
    log,
  };
}

// 적 1회 반격(비치명 행동 뒤).
function enemyTurn(state: RunState): RunState {
  const enemy = state.enemy!;
  const a = attackRoll(
    state.seed,
    enemy.atk,
    effectiveDef(state.player),
    false,
  );
  const player = damage(state.player, a.dmg);
  const dead = player.hp <= 0;
  const log = [...state.log, `${enemy.name}의 반격 — ${a.dmg} 피해.`];
  if (dead) log.push("당신은 심연에 쓰러졌다…");
  return {
    ...state,
    seed: a.seed,
    player,
    phase: dead ? "dead" : "combat",
    log,
  };
}

function flee(state: RunState): RunState {
  const enemy = state.enemy!;
  if (enemy.boss) {
    return { ...state, log: [...state.log, "보스에게서 도망칠 수 없다!"] };
  }
  const c = chance(state.seed, FLEE_CHANCE);
  if (c.value) {
    return {
      ...state,
      seed: c.seed,
      enemy: null,
      phase: "explore",
      log: [...state.log, "도망쳤다."],
    };
  }
  return enemyTurn({
    ...state,
    seed: c.seed,
    log: [...state.log, "도망 실패!"],
  });
}

function drinkPotion(state: RunState): RunState {
  if (state.phase !== "combat" && state.phase !== "explore") return state;
  const u = consumePotion(state.player);
  if (!u) return { ...state, log: [...state.log, "물약이 없다."] };
  const log = [...state.log, `물약 — HP ${u.healed} 회복.`];
  // 전투 중 사용은 한 턴 소모(적 반격).
  if (state.phase === "combat")
    return enemyTurn({ ...state, player: u.player, log });
  return { ...state, player: u.player, log };
}

function buy(state: RunState, index: number): RunState {
  const item = state.shop[index];
  if (!item) return state;
  if (state.player.gold < item.price) {
    return { ...state, log: [...state.log, "골드가 부족하다."] };
  }
  let player = addGold(state.player, -item.price);
  if (item.kind === "potion")
    player = { ...player, potions: [...player.potions, item] };
  else if (item.kind === "weapon") player = { ...player, weapon: item };
  else player = { ...player, armor: item };
  return {
    ...state,
    player,
    log: [...state.log, `${item.name} 구매 (−${item.price} 골드).`],
  };
}

function descend(state: RunState): RunState {
  const depth = state.depth + 1;
  return {
    ...state,
    depth,
    step: 0,
    phase: "explore",
    log: [...state.log, floorIntro(depth)],
  };
}
