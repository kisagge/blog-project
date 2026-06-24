import { describe, expect, test } from "vitest";
import { escapeXml, renderRssFeed } from "@/lib/rss";

describe("escapeXml", () => {
  test("XML 특수문자 5종 이스케이프", () => {
    expect(escapeXml(`a<b>&'"`)).toBe("a&lt;b&gt;&amp;&apos;&quot;");
  });
});

describe("renderRssFeed", () => {
  const xml = renderRssFeed({
    title: "제목 & <b>",
    link: "https://x/series/s",
    description: '설명 "q"',
    selfUrl: "https://x/series/s/rss.xml",
    items: [
      {
        title: "글1 <i>",
        url: "https://x/feed/a",
        pubDate: new Date("2026-01-02T03:04:05Z"),
        description: "  요약1  ",
      },
      {
        title: "글2",
        url: "https://x/feed/b",
        pubDate: new Date("2026-01-01T00:00:00Z"),
      },
    ],
  });

  test("채널 title/description escape + self atom:link", () => {
    expect(xml).toContain("<title>제목 &amp; &lt;b&gt;</title>");
    expect(xml).toContain("<description>설명 &quot;q&quot;</description>");
    expect(xml).toContain('href="https://x/series/s/rss.xml" rel="self"');
    expect(xml).toContain("<language>ko</language>");
  });

  test("item: link=guid, pubDate는 UTC, 설명 trim+escape", () => {
    expect(xml).toContain("<title>글1 &lt;i&gt;</title>");
    expect(xml).toContain('<guid isPermaLink="true">https://x/feed/a</guid>');
    expect(xml).toContain("<pubDate>Fri, 02 Jan 2026 03:04:05 GMT</pubDate>");
    expect(xml).toContain("<description>요약1</description>"); // 공백 trim
  });

  test("설명 없는 item은 <description> 미출력", () => {
    const block2 = xml.slice(xml.indexOf("글2"));
    expect(block2).not.toContain("<description>");
  });
});
