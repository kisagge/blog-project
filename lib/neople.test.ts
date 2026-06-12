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

  test("getEquipment: equipment 배열 추출", async () => {
    stubFetch({ equipment: [{ slotId: "WEAPON", itemName: "폭군의 본의" }] });
    const eq = await neople.getEquipment("cain", "id1");
    expect(eq).toHaveLength(1);
    expect(eq[0].itemName).toBe("폭군의 본의");
  });

  test("getTimeline: rows 추출 + limit 파라미터 부착, 비면 빈 배열", async () => {
    const f = stubFetch({ timeline: { rows: [{ code: 504, name: "획득" }] } });
    const rows = await neople.getTimeline("cain", "id1", 15);
    expect(rows).toHaveLength(1);
    expect(String(f.mock.calls[0][0])).toContain("limit=15");

    stubFetch({}); // timeline 키 없음
    expect(await neople.getTimeline("cain", "id1")).toEqual([]);
  });

  test("getCreature: 없으면 null", async () => {
    stubFetch({ creature: null });
    expect(await neople.getCreature("cain", "id1")).toBeNull();
  });

  test("getSkillStyle: skill.style 추출, 없으면 null", async () => {
    stubFetch({
      skill: { style: { active: [{ skillId: "a", name: "위빙" }] } },
    });
    const style = await neople.getSkillStyle("cain", "id1");
    expect(style?.active?.[0].name).toBe("위빙");

    stubFetch({}); // skill 키 없음
    expect(await neople.getSkillStyle("cain", "id1")).toBeNull();
  });

  test("getOath: oath 추출, 없으면 null", async () => {
    stubFetch({ oath: { info: { itemId: "o", itemName: "발키리 서약" } } });
    const oath = await neople.getOath("cain", "id1");
    expect(oath?.info.itemName).toBe("발키리 서약");

    stubFetch({ oath: null });
    expect(await neople.getOath("cain", "id1")).toBeNull();
  });

  test("getMistAssimilation: 추출, 없으면 null", async () => {
    stubFetch({ mistAssimilation: { level: 31, status: [] } });
    const mist = await neople.getMistAssimilation("cain", "id1");
    expect(mist?.level).toBe(31);

    stubFetch({ mistAssimilation: null });
    expect(await neople.getMistAssimilation("cain", "id1")).toBeNull();
  });
});
