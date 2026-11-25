import "server-only";
import {
  getAvatar,
  getBuffEquipment,
  getCharacterStatus,
  getCreature,
  getEquipment,
  getMistAssimilation,
  getOath,
  getSkillStyle,
  getTimeline,
} from "@/lib/neople";

// 캐릭터 상세 데이터(Neople API 9종 병렬). 각 조회 실패는 빈 값으로 — 일부가 없어도 나머지 탭은 표시.
export async function loadCharacterDetail(server: string, characterId: string) {
  const [
    status,
    equipment,
    avatar,
    creature,
    timeline,
    skill,
    oath,
    mist,
    buff,
  ] = await Promise.all([
    getCharacterStatus(server, characterId).catch(() => null),
    getEquipment(server, characterId).catch(() => ({ items: [], sets: [] })),
    getAvatar(server, characterId).catch(() => []),
    getCreature(server, characterId).catch(() => null),
    getTimeline(server, characterId, 15).catch(() => []),
    getSkillStyle(server, characterId).catch(() => null),
    getOath(server, characterId).catch(() => null),
    getMistAssimilation(server, characterId).catch(() => null),
    getBuffEquipment(server, characterId).catch(() => null),
  ]);
  return {
    status,
    equipment,
    avatar,
    creature,
    timeline,
    skill,
    oath,
    mist,
    buff,
  };
}

export type CharacterDetail = Awaited<ReturnType<typeof loadCharacterDetail>>;
