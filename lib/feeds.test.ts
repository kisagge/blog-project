import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";

type Feeds = typeof import("@/lib/feeds");
let searchFeeds: Feeds["searchFeeds"];
let countFeeds: Feeds["countFeeds"];
let getAdminFeedsPage: Feeds["getAdminFeedsPage"];
let getRelatedFeeds: Feeds["getRelatedFeeds"];
let getPublicTopFeeds: Feeds["getPublicTopFeeds"];
let getAdjacentFeeds: Feeds["getAdjacentFeeds"];
let cleanup: () => Promise<void>;
let prisma: Awaited<ReturnType<typeof setupTestDb>>["prisma"];

beforeAll(async () => {
  const db = await setupTestDb();
  cleanup = db.cleanup;
  prisma = db.prisma;

  // 전체공개 글 12개(오래된→최신). pub-12가 최신.
  for (let i = 1; i <= 12; i++) {
    const date = new Date(2026, 0, i); // 2026-01-01 .. 01-12
    await db.prisma.feed.create({
      data: {
        id: `pub-${i}`,
        slug: `pub-${i}`,
        title: i === 3 ? "고양이 이야기" : `공개 글 ${i}`,
        summary: i === 9 ? "여우전용요약" : `요약 ${i}`,
        content: i === 7 ? "강아지물고기 본문" : `본문 ${i}`,
        visibility: "public",
        createdAt: date,
        updatedAt: date,
      },
    });
  }
  // 비공개(초안): 공개 목록·검색에서 제외돼야 함(고유 단어).
  await db.prisma.feed.create({
    data: {
      id: "draft-1",
      slug: "draft-1",
      title: "오직비공개단어 초안",
      content: "비공개 본문",
      visibility: "private",
      createdAt: new Date(2026, 1, 1),
      updatedAt: new Date(2026, 1, 1),
    },
  });
  // 회원공개: anon 목록 제외, 회원 목록 포함(고유 단어).
  await db.prisma.feed.create({
    data: {
      id: "mem-1",
      slug: "mem-1",
      title: "회원전용단어 회원글",
      content: "회원 본문",
      visibility: "members",
      createdAt: new Date(2026, 1, 2),
      updatedAt: new Date(2026, 1, 2),
    },
  });

  // 회원 작성자 + 회원 글(게시 published, 임시저장 draft).
  await db.prisma.user.create({
    data: {
      id: "u1",
      email: "u1@x.com",
      nickname: "유저1",
      passwordHash: "x",
      status: "approved",
      updatedAt: new Date(),
    },
  });
  // 회원 작성 게시글(회원공개, published): 회원 목록 포함, 관리자 CMS/집계 제외.
  await db.prisma.feed.create({
    data: {
      id: "umem-1",
      slug: "umem-1",
      title: "회원작성단어 게시글",
      content: "회원 작성 본문",
      visibility: "members",
      status: "published",
      authorId: "u1",
      publishedAt: new Date(2026, 1, 3),
      createdAt: new Date(2026, 1, 3),
      updatedAt: new Date(2026, 1, 3),
    },
  });
  // 회원 임시저장(draft): 어떤 목록에도 노출 안 됨.
  await db.prisma.feed.create({
    data: {
      id: "udraft-1",
      slug: "udraft-1",
      title: "임시저장단어 초안",
      content: "임시저장 본문",
      visibility: "members",
      status: "draft",
      authorId: "u1",
      createdAt: new Date(2026, 1, 4),
      updatedAt: new Date(2026, 1, 4),
    },
  });

  // 태그: 공개 글 pub-3 = 고양이, 비공개 draft-1 = 비밀태그(공개 태그 필터에 안 나와야 함)
  const { setFeedTags } = await import("@/lib/tags");
  await setFeedTags("pub-3", ["고양이"]);
  await setFeedTags("draft-1", ["비밀태그"]);

  ({
    searchFeeds,
    countFeeds,
    getAdminFeedsPage,
    getRelatedFeeds,
    getPublicTopFeeds,
    getAdjacentFeeds,
  } = await import("@/lib/feeds"));
});

afterAll(async () => {
  await cleanup();
});

describe("searchFeeds", () => {
  test("anon 첫 페이지는 10개 + hasMore=true (전체공개 12개)", async () => {
    const { items, hasMore } = await searchFeeds({ role: "anon" });
    expect(items).toHaveLength(10);
    expect(hasMore).toBe(true);
  });

  test("신고로 가려진(hiddenAt) 글은 목록·검색에서 제외", async () => {
    await prisma.feed.create({
      data: {
        id: "hidden-1",
        slug: "hidden-1",
        title: "가려진고유단어 글",
        content: "본문",
        visibility: "public",
        hiddenAt: new Date(),
      },
    });
    const all = await searchFeeds({ role: "anon", q: "가려진고유단어" });
    expect(all.items).toHaveLength(0);
    // 숨김 해제하면 다시 보임
    await prisma.feed.update({
      where: { id: "hidden-1" },
      data: { hiddenAt: null },
    });
    const after = await searchFeeds({ role: "anon", q: "가려진고유단어" });
    expect(after.items.map((f) => f.slug)).toEqual(["hidden-1"]);
    // 공유 DB 오염 방지: 다른 테스트의 카운트·정렬에 영향 없도록 제거.
    await prisma.feed.delete({ where: { id: "hidden-1" } });
  });

  test("태그 필터: 해당 태그 글만, 비공개 태그는 공개 필터 제외", async () => {
    const cat = await searchFeeds({ role: "anon", tag: "고양이" });
    expect(cat.items.map((f) => f.slug)).toEqual(["pub-3"]);
    // 카드에 태그가 실려옴
    expect(cat.items[0].feedTags.map((t) => t.tag.slug)).toEqual(["고양이"]);
    // draft-1(비공개)의 태그는 anon·회원 모두에게 안 보임
    expect(
      (await searchFeeds({ role: "anon", tag: "비밀태그" })).items,
    ).toHaveLength(0);
    expect(
      (await searchFeeds({ role: "member", tag: "비밀태그" })).items,
    ).toHaveLength(0);
  });

  test("skip으로 다음 페이지: 남은 2개 + hasMore=false", async () => {
    const { items, hasMore } = await searchFeeds({ role: "anon", skip: 10 });
    expect(items).toHaveLength(2);
    expect(hasMore).toBe(false);
  });

  test("최신순 정렬: 첫 글이 가장 최근(pub-12)", async () => {
    const { items } = await searchFeeds({ role: "anon" });
    expect(items[0].slug).toBe("pub-12");
  });

  test("제목 검색", async () => {
    const { items } = await searchFeeds({ role: "anon", q: "고양이" });
    expect(items.map((f) => f.slug)).toEqual(["pub-3"]);
  });

  test("본문 검색(제목·요약엔 없는 단어)", async () => {
    const { items } = await searchFeeds({ role: "anon", q: "강아지물고기" });
    expect(items.map((f) => f.slug)).toEqual(["pub-7"]);
  });

  test("FTS 부분일치: 3자 토큰이 단어 중간에 매치(trigram)", async () => {
    // pub-7 content "강아지물고기 본문" — "물고기"(3자)가 부분일치
    const { items } = await searchFeeds({ role: "anon", q: "물고기" });
    expect(items.map((f) => f.slug)).toEqual(["pub-7"]);
  });

  test("검색 결과에 매치 중심 스니펫 부착(FTS 경로)", async () => {
    const { items } = await searchFeeds({ role: "anon", q: "강아지물고기" });
    expect(items[0].slug).toBe("pub-7");
    expect(items[0].snippet).toContain("강아지물고기");
  });

  test("검색 결과에 스니펫 부착(2자 폴백 경로)", async () => {
    // "본문"(2자) → contains 폴백. 각 글 content "본문 N"에서 발췌.
    const { items } = await searchFeeds({ role: "anon", q: "본문" });
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].snippet).toContain("본문");
  });

  test("비검색 목록은 스니펫 없음", async () => {
    const { items } = await searchFeeds({ role: "anon" });
    expect(items[0].snippet).toBeUndefined();
  });

  test("FTS BM25 랭킹: 제목 매치가 본문 매치보다 먼저", async () => {
    await prisma.feed.create({
      data: {
        id: "rk-title",
        slug: "rk-title",
        title: "랭킹고유단어 글",
        content: "본문",
        visibility: "public",
        createdAt: new Date(2026, 2, 1),
        updatedAt: new Date(2026, 2, 1),
      },
    });
    await prisma.feed.create({
      data: {
        id: "rk-body",
        slug: "rk-body",
        title: "보통 글",
        content: "본문에 랭킹고유단어 포함",
        visibility: "public",
        createdAt: new Date(2026, 2, 2),
        updatedAt: new Date(2026, 2, 2),
      },
    });
    const { items } = await searchFeeds({ role: "anon", q: "랭킹고유단어" });
    expect(items.map((f) => f.slug)).toEqual(["rk-title", "rk-body"]);
    await prisma.feed.delete({ where: { id: "rk-title" } });
    await prisma.feed.delete({ where: { id: "rk-body" } });
  });

  test("FTS 다중 토큰 AND: 모든 토큰을 포함한 글만", async () => {
    await prisma.feed.create({
      data: {
        id: "and-both",
        slug: "and-both",
        title: "글",
        content: "사과나무 그리고 바나나칩",
        visibility: "public",
        createdAt: new Date(2026, 2, 3),
        updatedAt: new Date(2026, 2, 3),
      },
    });
    await prisma.feed.create({
      data: {
        id: "and-one",
        slug: "and-one",
        title: "글",
        content: "사과나무만 있음",
        visibility: "public",
        createdAt: new Date(2026, 2, 4),
        updatedAt: new Date(2026, 2, 4),
      },
    });
    const { items } = await searchFeeds({ role: "anon", q: "사과나무 바나나칩" });
    expect(items.map((f) => f.slug)).toEqual(["and-both"]);
    await prisma.feed.delete({ where: { id: "and-both" } });
    await prisma.feed.delete({ where: { id: "and-one" } });
  });

  test("짧은 쿼리(2자)는 trigram 미적격 → contains 폴백", async () => {
    // "고양"(2자) → FTS 미적격 → contains 폴백으로 pub-3("고양이 이야기") 매치
    const { items } = await searchFeeds({ role: "anon", q: "고양" });
    expect(items.map((f) => f.slug)).toEqual(["pub-3"]);
  });

  test("FTS 특수문자/따옴표가 들어와도 throw 없이 처리", async () => {
    await expect(
      searchFeeds({ role: "anon", q: '강아지물고기"' }),
    ).resolves.toBeDefined();
    await expect(
      searchFeeds({ role: "anon", q: "강아지 AND OR" }),
    ).resolves.toBeDefined();
  });

  test("FTS: 글 제목 수정 시 색인 갱신(새 단어 검색, 옛 단어 제거)", async () => {
    await prisma.feed.create({
      data: {
        id: "edit-1",
        slug: "edit-1",
        title: "수정전고유단어",
        content: "본문",
        visibility: "public",
        createdAt: new Date(2026, 2, 5),
        updatedAt: new Date(2026, 2, 5),
      },
    });
    expect(
      (await searchFeeds({ role: "anon", q: "수정전고유단어" })).items.map(
        (f) => f.slug,
      ),
    ).toEqual(["edit-1"]);
    // AFTER UPDATE OF title 트리거가 옛 행 제거 + 새 행 색인.
    await prisma.feed.update({
      where: { id: "edit-1" },
      data: { title: "수정후고유단어" },
    });
    expect(
      (await searchFeeds({ role: "anon", q: "수정후고유단어" })).items.map(
        (f) => f.slug,
      ),
    ).toEqual(["edit-1"]);
    expect(
      (await searchFeeds({ role: "anon", q: "수정전고유단어" })).items,
    ).toHaveLength(0);
    await prisma.feed.delete({ where: { id: "edit-1" } });
  });

  test("비공개 글은 anon·회원 목록에서 제외, 관리자는 노출", async () => {
    for (const role of ["anon", "member"] as const) {
      const { items } = await searchFeeds({ role, q: "오직비공개단어" });
      expect(items).toHaveLength(0);
    }
    const { items } = await searchFeeds({ role: "admin", q: "오직비공개단어" });
    expect(items).toHaveLength(1);
  });

  test("회원공개 글: anon 제외, 회원 포함", async () => {
    expect(
      (await searchFeeds({ role: "anon", q: "회원전용단어" })).items,
    ).toHaveLength(0);
    const m = await searchFeeds({ role: "member", q: "회원전용단어" });
    expect(m.items.map((f) => f.slug)).toEqual(["mem-1"]);
  });

  test("임시저장(draft)은 회원·관리자 목록 모두에서 제외", async () => {
    for (const role of ["member", "admin"] as const) {
      const { items } = await searchFeeds({ role, q: "임시저장단어" });
      expect(items).toHaveLength(0);
    }
  });

  test("회원 작성 게시글: anon 제외, 회원 목록 포함", async () => {
    expect(
      (await searchFeeds({ role: "anon", q: "회원작성단어" })).items,
    ).toHaveLength(0);
    const m = await searchFeeds({ role: "member", q: "회원작성단어" });
    expect(m.items.map((f) => f.slug)).toEqual(["umem-1"]);
  });

  test("author=admin: 관리자 글만(회원 글 제외)", async () => {
    // 회원 작성 글은 author=admin에 안 나옴
    expect(
      (await searchFeeds({ role: "member", q: "회원작성단어", author: "admin" }))
        .items,
    ).toHaveLength(0);
    // 관리자 회원공개 글은 나옴
    const a = await searchFeeds({
      role: "member",
      q: "회원전용단어",
      author: "admin",
    });
    expect(a.items.map((f) => f.slug)).toEqual(["mem-1"]);
  });

  test("author=member: 회원 글만(관리자 글 제외)", async () => {
    // 회원 글만 나옴(작성자 닉네임 포함)
    const m = await searchFeeds({ role: "member", author: "member" });
    expect(m.items.every((f) => f.slug === "umem-1")).toBe(true);
    expect(m.items.map((f) => f.slug)).toContain("umem-1");
    // 관리자 회원공개 글(mem-1)은 회원 목록에 없음
    expect(
      (await searchFeeds({ role: "member", q: "회원전용단어", author: "member" }))
        .items,
    ).toHaveLength(0);
    // 작성자 닉네임이 실려옴
    const card = m.items.find((f) => f.slug === "umem-1");
    expect(card?.author?.nickname).toBe("유저1");
  });

  test("getRelatedFeeds: 공유 태그순 추천, self·권한·태그없음 처리", async () => {
    const { setFeedTags } = await import("@/lib/tags");
    const mk = async (id: string, vis = "public", status = "published") => {
      await prisma.feed.create({
        data: { id, slug: id, title: id, content: "c", visibility: vis, status },
      });
    };
    await mk("rel-base");
    await mk("rel-r2");
    await mk("rel-r1");
    await mk("rel-priv", "private");
    await setFeedTags("rel-base", ["관련가", "관련나"]);
    await setFeedTags("rel-r2", ["관련가", "관련나"]); // 공유 2
    await setFeedTags("rel-r1", ["관련가"]); // 공유 1
    await setFeedTags("rel-priv", ["관련가"]); // 비공개
    const base = await prisma.feed.findUnique({
      where: { id: "rel-base" },
      select: { feedTags: { select: { tag: { select: { slug: true } } } } },
    });
    const slugs = base!.feedTags.map((ft) => ft.tag.slug);

    const anon = await getRelatedFeeds("rel-base", slugs, "anon", 5);
    expect(anon.map((f) => f.slug)).toEqual(["rel-r2", "rel-r1"]); // 공유 2 먼저, self·private 제외
    // 관리자는 비공개 포함
    const admin = await getRelatedFeeds("rel-base", slugs, "admin", 5);
    expect(admin.map((f) => f.slug)).toContain("rel-priv");
    // 태그 없으면 빈 배열
    expect(await getRelatedFeeds("rel-base", [], "anon")).toEqual([]);

    for (const id of ["rel-base", "rel-r2", "rel-r1", "rel-priv"])
      await prisma.feed.delete({ where: { id } });
  });

  test("countFeeds: 관리자 글만 집계(회원 글 제외)", async () => {
    expect(await countFeeds()).toEqual({
      total: 14,
      public: 12,
      members: 1,
      private: 1,
    });
  });

  test("getAdminFeedsPage: 관리자 글만(회원 글 제외), 페이지네이션(총14, size10)", async () => {
    const p1 = await getAdminFeedsPage(1, 10);
    expect(p1.items).toHaveLength(10);
    expect(p1.total).toBe(14);
    const p2 = await getAdminFeedsPage(2, 10);
    expect(p2.items).toHaveLength(4);
    // 회원 글(authorId 있음)은 관리자 목록에 없음.
    const allSlugs = [...p1.items, ...p2.items].map((f) => f.slug);
    expect(allSlugs).not.toContain("umem-1");
    expect(allSlugs).not.toContain("udraft-1");
  });
});

describe("getPublicTopFeeds", () => {
  test("조회수 내림차순 + 가시성 필터(anon/member) + 숨김·초안 제외", async () => {
    const mk = (id: string, over: Record<string, unknown>) =>
      prisma.feed.create({
        data: {
          id,
          slug: id,
          title: id,
          content: "c",
          createdAt: new Date(2026, 5, 1),
          updatedAt: new Date(2026, 5, 1),
          ...over,
        },
      });
    await mk("top-a", { visibility: "public", viewCount: 500 });
    await mk("top-b", { visibility: "public", viewCount: 300 });
    await mk("top-mem", { visibility: "members", viewCount: 999 });
    await mk("top-hidden", { visibility: "public", viewCount: 999, hiddenAt: new Date() });

    const anon = (await getPublicTopFeeds("anon")).map((f) => f.slug);
    expect(anon).not.toContain("top-hidden"); // 신고 숨김 제외
    expect(anon).not.toContain("top-mem"); // 회원공개는 anon 제외
    expect(anon[0]).toBe("top-a"); // 최고 조회수(500)
    expect(anon.indexOf("top-a")).toBeLessThan(anon.indexOf("top-b")); // 500 > 300

    const member = (await getPublicTopFeeds("member")).map((f) => f.slug);
    expect(member[0]).toBe("top-mem"); // 999, 회원에겐 보임

    for (const id of ["top-a", "top-b", "top-mem", "top-hidden"])
      await prisma.feed.delete({ where: { id } });
  });
});

describe("getAdjacentFeeds", () => {
  async function adj(slug: string, role: "anon" | "member" = "anon") {
    const f = await prisma.feed.findUnique({
      where: { slug },
      select: { id: true, createdAt: true, authorId: true },
    });
    return getAdjacentFeeds(f!, role);
  }

  test("시간순 이전(오래된)·다음(최신) 1건씩", async () => {
    const { prev, next } = await adj("pub-5");
    expect(prev?.slug).toBe("pub-4");
    expect(next?.slug).toBe("pub-6");
  });

  test("양 끝은 null", async () => {
    expect((await adj("pub-1")).prev).toBeNull();
    expect((await adj("pub-12")).next).toBeNull();
  });

  test("작성자 분류 격리: 회원 글의 이웃은 회원 글만(관리자 글 미혼입)", async () => {
    // umem-1(회원 published)의 더 오래된 글은 admin pub-12뿐이나 author-scope=member라 제외 → prev null.
    expect((await adj("umem-1", "member")).prev).toBeNull();
  });
});
