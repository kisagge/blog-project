import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Neople = typeof import("@/lib/neople");
let neople: Neople;

beforeAll(async () => {
  process.env.NEOPLE_API_KEY = "testkey";
  neople = await import("@/lib/neople");
});
afterEach(() => vi.unstubAllGlobals());

function stubFetch(body: unknown, ok = true, status = 200) {
  const f = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  });
  vi.stubGlobal("fetch", f);
  return f;
}

describe("neople API client", () => {
  test("getServers: rows 반환 + apikey 부착", async () => {
    const f = stubFetch({ rows: [{ serverId: "cain", serverName: "카인" }] });
    const rows = await neople.getServers();
    expect(rows).toEqual([{ serverId: "cain", serverName: "카인" }]);
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain("/df/servers");
    expect(url).toContain("apikey=testkey");
  });

  test("searchCharacter: 한글 캐릭터명 URL 인코딩", async () => {
    const f = stubFetch({ rows: [] });
    await neople.searchCharacter("cain", "로제빠아앙");
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain("/df/servers/cain/characters");
    expect(url).toContain("characterName=" + encodeURIComponent("로제빠아앙"));
  });

  test("에러 응답이면 NeopleError(메시지·코드 전달)", async () => {
    stubFetch(
      { error: { code: "DF001", message: "캐릭터 정보가 없습니다." } },
      false,
      400,
    );
    await expect(neople.getCharacterInfo("cain", "bad")).rejects.toMatchObject({
      name: "NeopleError",
      message: "캐릭터 정보가 없습니다.",
      code: "DF001",
    });
  });

  test("이미지 URL 헬퍼(apikey 불필요)", () => {
    expect(neople.characterImageUrl("cain", "id1", 2)).toBe(
      "https://img-api.neople.co.kr/df/servers/cain/characters/id1?zoom=2",
    );
    expect(neople.itemImageUrl("it1")).toBe(
      "https://img-api.neople.co.kr/df/items/it1",
    );
  });
});
