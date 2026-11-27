import { createTtlCache } from "@/lib/ttl-cache";
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

// 완성된 RSS XML 캐시(5분). 피드 리더·봇이 주기적으로 긁어 가는데 매번 글 20개를 마크다운→HTML로
// 변환하면 이벤트 루프를 막는다. 관리자 글 저장·삭제·예약 발행 때 clear()로 바로 반영.
export const RSS_TTL_SECONDS = 300;
// null = 피드 없음(공개 글 0개 시리즈 등 → 404).
export const rssCache = createTtlCache<string | null>({
  ttlMs: RSS_TTL_SECONDS * 1000,
  max: 100, // 전체 피드 + 시리즈별 피드
});

export function rssResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": `public, max-age=${RSS_TTL_SECONDS}`,
    },
  });
}
