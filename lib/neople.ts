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
