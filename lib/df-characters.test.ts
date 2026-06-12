import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { setupTestDb } from "@/lib/test-db";

vi.mock("server-only", () => ({}));

type Mod = typeof import("@/lib/df-characters");
let m: Mod;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const db = await setupTestDb();
  cleanup = db.cleanup;
  m = await import("@/lib/df-characters");
});
afterAll(async () => {
  await cleanup();
});

describe("df-characters", () => {
  test("등록 후 목록에 보인다", async () => {
    await m.addFeatured({
      serverId: "cain",
      characterId: "abc",
      characterName: "로제빠아앙",
    });
    const list = await m.listFeatured();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      serverId: "cain",
      characterId: "abc",
      characterName: "로제빠아앙",
    });
  });

  test("같은 server+character 재등록은 이름만 갱신(중복 없음)", async () => {
    await m.addFeatured({
      serverId: "cain",
      characterId: "abc",
      characterName: "새이름",
    });
    const list = await m.listFeatured();
    expect(list).toHaveLength(1);
    expect(list[0].characterName).toBe("새이름");
  });

  test("다른 캐릭터는 별도로 추가", async () => {
    await m.addFeatured({
      serverId: "bakal",
      characterId: "xyz",
      characterName: "둘째",
    });
    expect(await m.listFeatured()).toHaveLength(2);
  });

  test("삭제하면 목록에서 빠진다", async () => {
    const list = await m.listFeatured();
    const target = list.find((c) => c.characterId === "xyz")!;
    await m.removeFeatured(target.id);
    const after = await m.listFeatured();
    expect(after.some((c) => c.characterId === "xyz")).toBe(false);
  });

  test("reorderFeatured: 주어진 순서대로 sortOrder 갱신", async () => {
    await m.addFeatured({
      serverId: "anton",
      characterId: "a2",
      characterName: "둘",
    });
    await m.addFeatured({
      serverId: "prey",
      characterId: "a3",
      characterName: "셋",
    });
    let list = await m.listFeatured();
    expect(list).toHaveLength(3);
    const reversed = [...list].reverse().map((c) => c.id);
    await m.reorderFeatured(reversed);
    list = await m.listFeatured();
    expect(list.map((c) => c.id)).toEqual(reversed);
  });

  test("addFeatured: 신규는 맨 뒤에 배치", async () => {
    await m.addFeatured({
      serverId: "bakal",
      characterId: "a4",
      characterName: "넷",
    });
    const list = await m.listFeatured();
    expect(list[list.length - 1].characterId).toBe("a4");
  });
});
