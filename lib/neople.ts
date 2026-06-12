import "server-only";

// 던전앤파이터 Neople 오픈 API 클라이언트. 모든 호출은 서버사이드(apikey 미노출).
// 문서: https://developers.neople.co.kr/contents/apiDocs/df
const BASE = "https://api.neople.co.kr";
const IMG = "https://img-api.neople.co.kr";

export class NeopleError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
  ) {
    super(message);
    this.name = "NeopleError";
  }
}

function apiKey(): string {
  const k = process.env.NEOPLE_API_KEY;
  if (!k) throw new NeopleError("NEOPLE_API_KEY 미설정");
  return k;
}

type Params = Record<string, string | number | undefined>;

// revalidate: Next 데이터 캐시 TTL(초). 레이트리밋 회피용. 0이면 매번 새로 조회.
async function df<T>(
  path: string,
  params: Params = {},
  revalidate = 600,
): Promise<T> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  url.searchParams.set("apikey", apiKey());
  const res = await fetch(url, { next: { revalidate } });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.error) {
    throw new NeopleError(
      body?.error?.message ?? `Neople API 오류 (HTTP ${res.status})`,
      body?.error?.code,
      res.status,
    );
  }
  return body as T;
}

export type DfServer = { serverId: string; serverName: string };

export type DfCharacterRow = {
  serverId: string;
  characterId: string;
  characterName: string;
  level: number;
  jobId: string;
  jobGrowId: string;
  jobName: string;
  jobGrowName: string;
  fame?: number;
};

export type DfCharacterInfo = DfCharacterRow & {
  adventureName?: string;
  guildName?: string;
};

export async function getServers(): Promise<DfServer[]> {
  const r = await df<{ rows: DfServer[] }>("/df/servers", {}, 86400);
  return r.rows;
}

// 캐릭터명 검색(전방일치). serverId "all"이면 전체 서버 검색.
export async function searchCharacter(
  serverId: string,
  characterName: string,
): Promise<DfCharacterRow[]> {
  const r = await df<{ rows: DfCharacterRow[] }>(
    `/df/servers/${serverId}/characters`,
    { characterName, limit: 10 },
    0,
  );
  return r.rows ?? [];
}

export async function getCharacterInfo(
  serverId: string,
  characterId: string,
): Promise<DfCharacterInfo> {
  return df<DfCharacterInfo>(
    `/df/servers/${serverId}/characters/${characterId}`,
    {},
    600,
  );
}

// 이미지(apikey 불필요 — 클라이언트에서 직접 사용 가능). zoom 1~3.
export function characterImageUrl(
  serverId: string,
  characterId: string,
  zoom = 2,
): string {
  return `${IMG}/df/servers/${serverId}/characters/${characterId}?zoom=${zoom}`;
}

export function itemImageUrl(itemId: string): string {
  return `${IMG}/df/items/${itemId}`;
}

// ----- 상세(능력치/장비/아바타/크리쳐/타임라인) -----

export type DfStat = { name: string; value: number | string };

export type DfStatusResponse = DfCharacterInfo & {
  buff?: { name: string; level: number; status: DfStat[] }[] | null;
  status: DfStat[];
};

export type DfEquipItem = {
  slotId: string;
  slotName: string;
  itemId: string;
  itemName: string;
  itemRarity?: string;
  itemTypeDetail?: string;
  itemAvailableLevel?: number;
  setItemName?: string | null;
  reinforce?: number;
  amplificationName?: string | null;
  refine?: number;
  itemGradeName?: string | null;
  enchant?: { status?: DfStat[] } | null;
};

export type DfAvatarItem = {
  slotId: string;
  slotName: string;
  itemId: string;
  itemName: string;
  itemRarity?: string;
  optionAbility?: string | null;
  clone?: { itemId: string | null; itemName: string | null };
  emblems?: { slotColor: string; itemName: string; itemRarity?: string }[];
};

export type DfArtifact = {
  slotColor: string;
  itemId: string;
  itemName: string;
  itemRarity?: string;
};

export type DfCreature = {
  itemId: string;
  itemName: string;
  itemRarity?: string;
  clone?: { itemId: string | null; itemName: string | null };
  artifact?: DfArtifact[];
};

export type DfTimelineRow = {
  code: number;
  name: string;
  date: string;
  data?: { itemName?: string; itemRarity?: string } & Record<string, unknown>;
};

// 장착 장비의 활성 세트 효과.
export type DfActiveSet = {
  setItemName: string;
  setItemRarityName?: string;
  active?: {
    status?: DfStat[];
    setPoint?: { current?: number; min?: number; max?: number };
  };
};

export function getCharacterStatus(serverId: string, characterId: string) {
  return df<DfStatusResponse>(
    `/df/servers/${serverId}/characters/${characterId}/status`,
    {},
    600,
  );
}

export async function getEquipment(serverId: string, characterId: string) {
  const r = await df<{
    equipment?: DfEquipItem[];
    setItemInfo?: DfActiveSet[];
  }>(
    `/df/servers/${serverId}/characters/${characterId}/equip/equipment`,
    {},
    600,
  );
  return { items: r.equipment ?? [], sets: r.setItemInfo ?? [] };
}

export async function getAvatar(serverId: string, characterId: string) {
  const r = await df<{ avatar: DfAvatarItem[] }>(
    `/df/servers/${serverId}/characters/${characterId}/equip/avatar`,
    {},
    600,
  );
  return r.avatar ?? [];
}

export async function getCreature(serverId: string, characterId: string) {
  const r = await df<{ creature: DfCreature | null }>(
    `/df/servers/${serverId}/characters/${characterId}/equip/creature`,
    {},
    600,
  );
  return r.creature ?? null;
}

export async function getTimeline(
  serverId: string,
  characterId: string,
  limit = 15,
) {
  const r = await df<{ timeline?: { rows?: DfTimelineRow[] } }>(
    `/df/servers/${serverId}/characters/${characterId}/timeline`,
    { limit },
    300,
  );
  return r.timeline?.rows ?? [];
}

// ----- 스킬 스타일 / 서약 / 안개융화 -----

export type DfSkillEntry = {
  skillId: string;
  name?: string;
  level?: number;
  requiredLevel?: number;
};

export type DfSkillStyle = {
  active?: DfSkillEntry[];
  passive?: DfSkillEntry[];
};

export async function getSkillStyle(serverId: string, characterId: string) {
  const r = await df<{ skill?: { style?: DfSkillStyle } }>(
    `/df/servers/${serverId}/characters/${characterId}/skill/style`,
    {},
    600,
  );
  return r.skill?.style ?? null;
}

export type DfOathCrystal = {
  slotNo: number;
  itemId: string;
  itemName: string;
  itemRarity?: string;
};

export type DfOathStat = { key: string; value: number | string };

export type DfOath = {
  info: {
    itemId: string;
    itemName: string;
    itemRarity?: string;
    setPoint?: number;
  };
  crystal?: DfOathCrystal[];
  // 활성 세트 효과.
  setInfo?: {
    setName?: string;
    setOptionName?: string;
    setRarityName?: string;
    active?: { status?: DfOathStat[] };
  };
};

export async function getOath(serverId: string, characterId: string) {
  const r = await df<{ oath: DfOath | null }>(
    `/df/servers/${serverId}/characters/${characterId}/equip/oath`,
    {},
    600,
  );
  return r.oath ?? null;
}

export type DfMistAssimilation = {
  level: number;
  expRate?: string;
  status: DfStat[];
};

export async function getMistAssimilation(
  serverId: string,
  characterId: string,
) {
  const r = await df<{ mistAssimilation: DfMistAssimilation | null }>(
    `/df/servers/${serverId}/characters/${characterId}/equip/mist-assimilation`,
    {},
    600,
  );
  return r.mistAssimilation ?? null;
}

// 버프 스위칭(버프 강화) — 버프 스킬 + 그에 쓰는 장비.
export type DfBuffSwitching = {
  skillInfo?: {
    skillId: string;
    name: string;
    option?: { level: number; desc?: string; values?: string[] };
  };
  equipment?: DfEquipItem[];
};

export async function getBuffEquipment(serverId: string, characterId: string) {
  const r = await df<{ skill?: { buff?: DfBuffSwitching | null } }>(
    `/df/servers/${serverId}/characters/${characterId}/skill/buff/equip/equipment`,
    {},
    600,
  );
  return r.skill?.buff ?? null;
}
