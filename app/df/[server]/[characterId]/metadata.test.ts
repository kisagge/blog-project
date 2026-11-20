// 던파 캐릭터 상세 메타데이터: 본문과 같은 공개 범위 게이트를 따라야 한다 — 비공개·미등록 캐릭터의 이름·이미지가
// <head>(제목·OG)로 새지 않고, 회원공개 캐릭터는 비회원(=크롤러)에게 이름 없이 noindex.
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/neople", () => ({
  getCharacterInfo: vi.fn(async () => ({
    characterName: "비밀캐릭",
    level: 115,
    jobGrowName: "眞 웨펀마스터",
    fame: 70000,
  })),
  characterImageUrl: vi.fn(() => "https://img/char.png"),
}));
vi.mock("@/lib/df-characters", () => ({
  getFeaturedByCharacter: vi.fn(),
  listFeaturedVisible: vi.fn(async () => []),
}));
vi.mock("@/lib/dal", () => ({
  getViewerRole: vi.fn(async () => "anon"),
  isBlockedMember: vi.fn(async () => false),
}));
vi.mock("@/lib/site-config", () => ({ guardPublicAccess: vi.fn() }));

import { generateMetadata } from "@/app/df/[server]/[characterId]/page";
import { getFeaturedByCharacter } from "@/lib/df-characters";
import { getViewerRole } from "@/lib/dal";
import { getCharacterInfo } from "@/lib/neople";

const featured = vi.mocked(getFeaturedByCharacter);
const role = vi.mocked(getViewerRole);
const params = {
  params: Promise.resolve({ server: "cain", characterId: "x" }),
};
const row = (visibility: string) =>
  ({ id: "1", serverId: "cain", characterId: "x", visibility }) as Awaited<
    ReturnType<typeof getFeaturedByCharacter>
  >;

beforeEach(() => {
  vi.mocked(getCharacterInfo).mockClear();
  role.mockResolvedValue("anon");
});

describe("던파 상세 generateMetadata", () => {
  test("미등록 캐릭터: 이름·이미지 없이 '찾을 수 없음'(Neople 조회도 안 함)", async () => {
    featured.mockResolvedValue(null);
    const md = await generateMetadata(params);
    expect(md.title).toBe("찾을 수 없음");
    expect(JSON.stringify(md)).not.toContain("비밀캐릭");
    expect(md.openGraph).toBeUndefined();
    expect(getCharacterInfo).not.toHaveBeenCalled();
  });

  test("비공개 캐릭터를 비관리자가 보면 '찾을 수 없음'", async () => {
    featured.mockResolvedValue(row("private"));
    role.mockResolvedValue("member");
    const md = await generateMetadata(params);
    expect(md.title).toBe("찾을 수 없음");
    expect(JSON.stringify(md)).not.toContain("비밀캐릭");
  });

  test("회원공개 캐릭터를 비회원이 보면 이름 없이 noindex", async () => {
    featured.mockResolvedValue(row("members"));
    const md = await generateMetadata(params);
    expect(JSON.stringify(md)).not.toContain("비밀캐릭");
    expect(md.robots).toEqual({ index: false });
  });

  test("전체공개 캐릭터는 이름·설명·OG 이미지", async () => {
    featured.mockResolvedValue(row("public"));
    const md = await generateMetadata(params);
    expect(md.title).toBe("비밀캐릭 · 던파");
    expect(md.openGraph?.images).toEqual(["https://img/char.png"]);
  });
});
