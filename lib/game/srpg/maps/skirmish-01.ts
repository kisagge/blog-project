// 첫 전투 맵 "갈라진 들판"(8×10). JSON-호환 데이터(tiles=지형 enum 인덱스).
// 0=평지 1=숲 2=언덕 3=물 4=벽. 아군(dawn) 4 vs 적(ashen) 5. 중앙에 숲/언덕/물/벽으로 길목 형성.
import type { RawMap } from "../map";

export const SKIRMISH_01: RawMap = {
  id: "skirmish-01",
  name: "갈라진 들판",
  cols: 8,
  rows: 10,
  // prettier-ignore
  tiles: [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 0, 0, 2, 0],
    [0, 2, 1, 3, 3, 1, 2, 0],
    [0, 2, 1, 3, 3, 1, 2, 0],
    [0, 0, 1, 1, 0, 0, 2, 0],
    [0, 0, 0, 4, 4, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ],
  units: [
    // 아군(여명단): 하단
    { faction: "dawn", cls: "warrior", col: 1, row: 8 },
    { faction: "dawn", cls: "archer", col: 3, row: 8 },
    { faction: "dawn", cls: "mage", col: 5, row: 8 },
    { faction: "dawn", cls: "cleric", col: 6, row: 9 },
    // 적(잿더미단): 상단
    { faction: "ashen", cls: "warrior", col: 1, row: 1 },
    { faction: "ashen", cls: "warrior", col: 5, row: 0 },
    { faction: "ashen", cls: "archer", col: 4, row: 1 },
    { faction: "ashen", cls: "mage", col: 6, row: 1 },
    { faction: "ashen", cls: "cleric", col: 3, row: 0 },
  ],
};
