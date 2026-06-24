// 맵 "언덕 요새"(7×8). 중앙 언덕 고지(벽 핵)로 좁고 치열한 근접전.
// 0=평지 1=숲 2=언덕 3=물 4=벽.
import type { RawMap } from "../map";

export const SKIRMISH_03: RawMap = {
  id: "skirmish-03",
  name: "언덕 요새",
  cols: 7,
  rows: 8,
  // prettier-ignore
  tiles: [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 1, 0, 0, 0, 1, 0],
    [0, 0, 2, 2, 2, 0, 0],
    [0, 0, 2, 4, 2, 0, 0],
    [0, 0, 2, 2, 2, 0, 0],
    [0, 1, 0, 0, 0, 1, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
  ],
  units: [
    { faction: "dawn", cls: "warrior", col: 1, row: 7 },
    { faction: "dawn", cls: "archer", col: 5, row: 7 },
    { faction: "dawn", cls: "mage", col: 3, row: 7 },
    { faction: "dawn", cls: "cleric", col: 3, row: 6 },
    { faction: "ashen", cls: "warrior", col: 0, row: 1 },
    { faction: "ashen", cls: "warrior", col: 6, row: 1 },
    { faction: "ashen", cls: "archer", col: 5, row: 0 },
    { faction: "ashen", cls: "mage", col: 1, row: 0 },
    { faction: "ashen", cls: "cleric", col: 3, row: 0 },
  ],
};
