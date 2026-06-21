import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { setupTestDb } from "@/lib/test-db";
import { makeFeed } from "@/lib/test-factories";

vi.mock("server-only", () => ({}));

type M = typeof import("@/lib/tags");
type Prisma = (typeof import("@/lib/prisma"))["prisma"];
let m: M;
let prisma: Prisma;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const db = await setupTestDb();
  cleanup = db.cleanup;
  prisma = db.prisma as Prisma;
  m = await import("@/lib/tags");
});
afterAll(async () => {
  await cleanup();
});

describe("slugifyTag / parseTags", () => {
  test("slug 정규화(한글 보존, 공백→하이픈, 소문자)", () => {
    expect(m.slugifyTag("개발 후기")).toBe("개발-후기");
    expect(m.slugifyTag("  Dev Log  ")).toBe("dev-log");
    expect(m.slugifyTag("던파")).toBe("던파");
  });

  test("parseTags: 중복(slug) 제거·빈값·초과길이 제외", () => {
    expect(m.parseTags("던파, 던파 , ,개발")).toEqual(["던파", "개발"]);
    expect(m.parseTags(`a, ${"x".repeat(21)}, b`)).toEqual(["a", "b"]);
    expect(m.parseTags("Dev, dev")).toEqual(["Dev"]); // ASCII 대소문자 병합
  });

  test("parseTags: 최대 5개로 잘라냄", () => {
    expect(m.parseTags("1,2,3,4,5,6,7")).toEqual(["1", "2", "3", "4", "5"]);
  });
});

describe("setFeedTags", () => {
  test("태그 생성·교체, 같은 slug는 Tag 1행 공유", async () => {
    const f1 = await makeFeed(prisma);
    const f2 = await makeFeed(prisma);

    await m.setFeedTags(f1.id, ["던파", "후기"]);
    await m.setFeedTags(f2.id, ["던파"]); // 같은 slug 재사용

    // Tag는 던파/후기 2개만(중복 생성 안 함)
    expect(await prisma.tag.count()).toBe(2);
    expect(await prisma.feedTag.count({ where: { feedId: f1.id } })).toBe(2);
    expect(await prisma.feedTag.count({ where: { feedId: f2.id } })).toBe(1);

    // 교체: f1 태그를 다른 집합으로
    await m.setFeedTags(f1.id, ["일상"]);
    const f1tags = await prisma.feedTag.findMany({
      where: { feedId: f1.id },
      select: { tag: { select: { slug: true } } },
    });
    expect(f1tags.map((t) => t.tag.slug)).toEqual(["일상"]);
    // 던파 Tag는 f2가 아직 쓰므로 잔존
    expect(
      await prisma.tag.findUnique({ where: { slug: "던파" } }),
    ).not.toBeNull();
  });

  test("빈 배열이면 태그 전부 제거", async () => {
    const f = await makeFeed(prisma);
    await m.setFeedTags(f.id, ["a", "b"]);
    await m.setFeedTags(f.id, []);
    expect(await prisma.feedTag.count({ where: { feedId: f.id } })).toBe(0);
  });
});

describe("getTagsWithCounts", () => {
  test("가시 글 태그만 글 수와 함께, 비공개/숨김/초안 제외, 글 수 내림차순", async () => {
    const pub1 = await makeFeed(prisma, { visibility: "public" });
    const pub2 = await makeFeed(prisma, { visibility: "public" });
    const mem = await makeFeed(prisma, { visibility: "members" });
    const hidden = await makeFeed(prisma, {
      visibility: "public",
      hiddenAt: new Date(),
    });
    const draft = await makeFeed(prisma, {
      visibility: "public",
      status: "draft",
    });
    await m.setFeedTags(pub1.id, ["디스공개"]);
    await m.setFeedTags(pub2.id, ["디스공개"]); // 같은 태그 2건
    await m.setFeedTags(mem.id, ["디스회원"]);
    await m.setFeedTags(hidden.id, ["디스숨김"]);
    await m.setFeedTags(draft.id, ["디스초안"]);

    const anon = await m.getTagsWithCounts("anon");
    const aCount = Object.fromEntries(anon.map((t) => [t.slug, t.count]));
    expect(aCount["디스공개"]).toBe(2);
    expect(aCount["디스회원"]).toBeUndefined(); // 회원공개 제외
    expect(aCount["디스숨김"]).toBeUndefined(); // 신고 숨김 제외
    expect(aCount["디스초안"]).toBeUndefined(); // 초안 제외

    const member = await m.getTagsWithCounts("member");
    const mCount = Object.fromEntries(member.map((t) => [t.slug, t.count]));
    expect(mCount["디스회원"]).toBe(1); // 회원에겐 보임
    // 내림차순: 디스공개(2)가 디스회원(1)보다 앞.
    const iPub = member.findIndex((t) => t.slug === "디스공개");
    const iMem = member.findIndex((t) => t.slug === "디스회원");
    expect(iPub).toBeLessThan(iMem);
  });
});

describe("getTagBySlug / getPublicTagSlugs", () => {
  test("getTagBySlug: 존재하는 slug는 표시명, 없으면 null", async () => {
    const f = await makeFeed(prisma, { visibility: "public" });
    await m.setFeedTags(f.id, ["바이슬러그"]);
    expect(await m.getTagBySlug("바이슬러그")).toEqual({
      name: "바이슬러그",
      slug: "바이슬러그",
    });
    expect(await m.getTagBySlug("없는슬러그zzz")).toBeNull();
  });

  test("getPublicTagSlugs: 전체공개 글 있는 태그만(회원공개·비공개 제외)", async () => {
    const pub = await makeFeed(prisma, { visibility: "public" });
    const mem = await makeFeed(prisma, { visibility: "members" });
    await m.setFeedTags(pub.id, ["퍼블릭전용"]);
    await m.setFeedTags(mem.id, ["멤버전용태그"]);
    const slugs = await m.getPublicTagSlugs();
    expect(slugs).toContain("퍼블릭전용");
    expect(slugs).not.toContain("멤버전용태그");
  });
});
