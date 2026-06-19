import { describe, expect, test } from "vitest";
import {
  buildFeedJsonLd,
  buildSiteJsonLd,
  jsonLdHtml,
} from "@/lib/structured-data";

const base = {
  slug: "hello-world",
  title: "안녕 세계",
  summary: "요약입니다",
  createdAt: new Date("2026-06-10T00:00:00Z"),
  updatedAt: new Date("2026-06-18T12:00:00Z"),
  publishedAt: new Date("2026-06-11T01:00:00Z"),
  authorId: "u1",
  feedTags: [{ tag: { name: "개발" } }, { tag: { name: "회고" } }],
};

// @graph[0] = BlogPosting, [1] = BreadcrumbList
function graph(json: object) {
  return (json as { "@graph": Record<string, unknown>[] })["@graph"];
}

describe("buildFeedJsonLd", () => {
  test("회원 글: BlogPosting 핵심 필드 + 작성자 프로필 URL", () => {
    const json = buildFeedJsonLd(base, "글쓴이");
    expect((json as Record<string, string>)["@context"]).toBe(
      "https://schema.org",
    );
    const post = graph(json)[0];
    expect(post["@type"]).toBe("BlogPosting");
    expect(post.headline).toBe("안녕 세계");
    expect(post.description).toBe("요약입니다");
    expect(post.url).toBe("https://by-jang-blog.xyz/feed/hello-world");
    expect(post.datePublished).toBe("2026-06-11T01:00:00.000Z");
    expect(post.dateModified).toBe("2026-06-18T12:00:00.000Z");
    expect(post.author).toMatchObject({
      "@type": "Person",
      name: "글쓴이",
      url: "https://by-jang-blog.xyz/u/u1",
    });
    expect(post.image).toBe(
      "https://by-jang-blog.xyz/feed/hello-world/opengraph-image",
    );
    expect(post.publisher).toMatchObject({ "@type": "Organization" });
    expect(post.keywords).toBe("개발, 회고");
    expect(post.inLanguage).toBe("ko-KR");
  });

  test("BreadcrumbList: 홈→피드→글 3단계 절대 URL", () => {
    const crumb = graph(buildFeedJsonLd(base, "글쓴이"))[1];
    expect(crumb["@type"]).toBe("BreadcrumbList");
    const items = crumb.itemListElement as Record<string, unknown>[];
    expect(items.map((i) => i.position)).toEqual([1, 2, 3]);
    expect(items[0].item).toBe("https://by-jang-blog.xyz/");
    expect(items[1].item).toBe("https://by-jang-blog.xyz/feed");
    expect(items[2].name).toBe("안녕 세계");
  });

  test("관리자 글(authorId null): author에 url 없음", () => {
    const post = graph(
      buildFeedJsonLd({ ...base, authorId: null }, "관리자"),
    )[0];
    expect(post.author).toEqual({ "@type": "Person", name: "관리자" });
  });

  test("summary 빈값·태그 없음 → description·keywords 키 생략", () => {
    const post = graph(
      buildFeedJsonLd({ ...base, summary: "  ", feedTags: [] }, "글쓴이"),
    )[0];
    expect(post).not.toHaveProperty("description");
    expect(post).not.toHaveProperty("keywords");
  });

  test("publishedAt null → datePublished가 createdAt로 폴백", () => {
    const post = graph(
      buildFeedJsonLd({ ...base, publishedAt: null }, "글쓴이"),
    )[0];
    expect(post.datePublished).toBe("2026-06-10T00:00:00.000Z");
  });
});

describe("buildSiteJsonLd", () => {
  test("@graph에 WebSite + Organization 2개", () => {
    const json = buildSiteJsonLd();
    expect((json as Record<string, string>)["@context"]).toBe(
      "https://schema.org",
    );
    const g = graph(json);
    expect(g.map((n) => n["@type"])).toEqual(["WebSite", "Organization"]);
  });

  test("WebSite: 사이트명·URL·설명·언어 + publisher가 Organization @id 참조", () => {
    const [website, org] = graph(buildSiteJsonLd());
    expect(website.name).toBe("BY Playground");
    expect(website.url).toBe("https://by-jang-blog.xyz/");
    expect(website.description).toBe("생각과 기록을 남기는 개인 공간");
    expect(website.inLanguage).toBe("ko-KR");
    // 그래프 연결: WebSite.publisher.@id === Organization.@id
    expect((website.publisher as Record<string, string>)["@id"]).toBe(
      org["@id"],
    );
  });

  test("WebSite.potentialAction: SearchAction이 /feed?q= 템플릿", () => {
    const website = graph(buildSiteJsonLd())[0];
    const action = website.potentialAction as Record<string, unknown>;
    expect(action["@type"]).toBe("SearchAction");
    expect((action.target as Record<string, string>).urlTemplate).toBe(
      "https://by-jang-blog.xyz/feed?q={search_term_string}",
    );
    expect(action["query-input"]).toBe("required name=search_term_string");
  });

  test("Organization: @id·이름·URL·로고", () => {
    const org = graph(buildSiteJsonLd())[1];
    expect(org["@id"]).toBe("https://by-jang-blog.xyz/#organization");
    expect(org.name).toBe("BY Playground");
    expect(org.url).toBe("https://by-jang-blog.xyz/");
    expect((org.logo as Record<string, string>).url).toBe(
      "https://by-jang-blog.xyz/icons/icon-512.png",
    );
  });

  test("jsonLdHtml(buildSiteJsonLd())는 유효 JSON", () => {
    const parsed = JSON.parse(jsonLdHtml(buildSiteJsonLd()));
    expect(parsed["@graph"]).toHaveLength(2);
  });
});

describe("jsonLdHtml", () => {
  test("'<'를 이스케이프해 </script> 주입을 차단하되 JSON은 유효", () => {
    const html = jsonLdHtml(
      buildFeedJsonLd({ ...base, title: "</script><b>x" }, "글쓴이"),
    );
    expect(html).not.toContain("<");
    expect(html).toContain("\\u003c");
    // 이스케이프를 되돌리면 그대로 파싱 가능(유효 JSON).
    const parsed = JSON.parse(html.replace(/\\u003c/g, "<"));
    expect(parsed["@graph"][0].headline).toBe("</script><b>x");
  });
});
