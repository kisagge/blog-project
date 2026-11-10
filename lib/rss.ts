// RSS 2.0 피드 생성 공용(순수). 글 RSS(/rss.xml)·시리즈 RSS(/series/[slug]/rss.xml) 공유.
// server-only 아님 — DB 접근 없이 문자열만 다루는 순수 함수라 테스트 용이.

const ESC: Record<string, string> = {
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  "'": "&apos;",
  '"': "&quot;",
};
export function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ESC[c]);
}

export type RssItem = {
  title: string;
  url: string; // 절대 URL(link·guid 공용)
  pubDate: Date;
  description?: string;
  contentHtml?: string; // 본문 전문 HTML(content:encoded). 이미 안전하게 생성된 HTML(markdownToFeedHtml)
};

// CDATA 안에서 종료 토큰 `]]>`가 나오면 구간을 끊어 이어붙임(내용 보존).
function cdata(s: string): string {
  return `<![CDATA[${s.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

// 채널 + items로 RSS 2.0 XML 생성. title/description은 DB 값일 수 있어 항상 escape.
export function renderRssFeed(opts: {
  title: string;
  link: string;
  description: string;
  selfUrl: string;
  items: RssItem[];
}): string {
  const items = opts.items
    .map((it) => {
      const summary = it.description?.trim();
      const desc = summary
        ? `\n      <description>${escapeXml(summary)}</description>`
        : "";
      const content = it.contentHtml
        ? `\n      <content:encoded>${cdata(it.contentHtml)}</content:encoded>`
        : "";
      return `    <item>
      <title>${escapeXml(it.title)}</title>
      <link>${it.url}</link>
      <guid isPermaLink="true">${it.url}</guid>
      <pubDate>${it.pubDate.toUTCString()}</pubDate>${desc}${content}
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(opts.title)}</title>
    <link>${opts.link}</link>
    <description>${escapeXml(opts.description)}</description>
    <language>ko</language>
    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${opts.selfUrl}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
}
