// 맵 "좌우 협곡"(10×10). 중앙 물/벽이 길을 둘로 갈라 측면 기동을 강제.
// 0=평지 1=숲 2=언덕 3=물 4=벽.
import type { RawMap } from "../map";

export const SKIRMISH_02: RawMap = {
  id: "skirmish-02",
  name: "좌우 협곡",
  cols: 10,
  rows: 10,
  // prettier-ignore
  tiles: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 1, 0, 2, 2, 0, 1, 0, 0],
    [0, 0, 0, 3, 3, 3, 3, 0, 0, 0],
    [0, 0, 0, 3, 4, 4, 3, 0, 0, 0],
    [0, 0, 0, 3, 4, 4, 3, 0, 0, 0],
    [0, 0, 0, 3, 3, 3, 3, 0, 0, 0],
    [0, 0, 1, 0, 2, 2, 0, 1, 0, 0],
    [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  units: [
    { faction: "dawn", cls: "warrior", col: 1, row: 9 },
    { faction: "dawn", cls: "archer", col: 3, row: 9 },
    { faction: "dawn", cls: "mage", col: 6, row: 9 },
    { faction: "dawn", cls: "cleric", col: 8, row: 8 },
    { faction: "ashen", cls: "warrior", col: 1, row: 0 },
    { faction: "ashen", cls: "warrior", col: 8, row: 0 },
    { faction: "ashen", cls: "archer", col: 3, row: 1 },
    { faction: "ashen", cls: "mage", col: 6, row: 1 },
    { faction: "ashen", cls: "cleric", col: 4, row: 0 },
  ],
};
