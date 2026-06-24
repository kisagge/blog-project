// 플레이 가능한 맵 레지스트리. 데이터로 분리 — 추후 맵 에디터·추가가 코드 변경 없이.
import type { RawMap } from "../map";
import { SKIRMISH_01 } from "./skirmish-01";
import { SKIRMISH_02 } from "./skirmish-02";
import { SKIRMISH_03 } from "./skirmish-03";

export type MapEntry = { id: string; name: string; raw: RawMap };

export const MAPS: MapEntry[] = [
  { id: SKIRMISH_01.id, name: SKIRMISH_01.name, raw: SKIRMISH_01 },
  { id: SKIRMISH_02.id, name: SKIRMISH_02.name, raw: SKIRMISH_02 },
  { id: SKIRMISH_03.id, name: SKIRMISH_03.name, raw: SKIRMISH_03 },
];

export function mapById(id: string): MapEntry {
  return MAPS.find((m) => m.id === id) ?? MAPS[0];
}
