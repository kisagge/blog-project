import { describe, expect, test } from "vitest";
import { renderLlmsTxt } from "@/lib/llms-txt";

const ORIGIN = "https://example.com";

describe("renderLlmsTxt", () => {
  const txt = renderLlmsTxt({
    origin: ORIGIN,
    name: "BY Playground",
    description: "개인 블로그",
    posts: [
      { slug: "a", title: "첫 글", summary: "요약\n두 줄" },
      { slug: "b", title: "[대괄호] 제목", summary: null },
    ],
  });

  test("llms.txt 형식: H1 이름 → 인용 요약 → H2 섹션 링크 목록", () => {
    const lines = txt.split("\n");
    expect(lines[0]).toBe("# BY Playground");
    expect(txt).toContain("\n> 개인 블로그\n");
    expect(txt).toContain("## 주요 페이지");
    expect(txt).toContain(`- [아카이브](${ORIGIN}/archive)`);
    expect(txt).toContain(`- [RSS](${ORIGIN}/rss.xml)`);
  });

  test("최근 글: 절대 URL + 요약(개행은 공백), 요약 없으면 링크만", () => {
    expect(txt).toContain("## 최근 글");
    expect(txt).toContain(`- [첫 글](${ORIGIN}/feed/a): 요약 두 줄`);
    expect(txt).toMatch(
      /- \[\\\[대괄호\\\] 제목\]\(https:\/\/example\.com\/feed\/b\)$/m,
    );
  });

  test("소개 링크는 hasAbout일 때만(주요 페이지 맨 앞)", () => {
    expect(txt).not.toContain("/about");
    const withAbout = renderLlmsTxt({
      origin: ORIGIN,
      name: "n",
      description: "d",
      posts: [],
      hasAbout: true,
    });
    expect(withAbout).toContain(
      `## 주요 페이지\n\n- [소개](${ORIGIN}/about): 블로그와 운영자 소개`,
    );
  });

  test("글이 없으면 최근 글 섹션 생략", () => {
    const empty = renderLlmsTxt({
      origin: ORIGIN,
      name: "n",
      description: "d",
      posts: [],
    });
    expect(empty).not.toContain("## 최근 글");
  });
});
