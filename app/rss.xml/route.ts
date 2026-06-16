import { prisma } from "@/lib/prisma";
import { SITE_ORIGIN } from "@/lib/share";

// 전체공개 글 RSS 2.0 피드. 요청 시 생성(빌드 타임 DB 접근 방지).
export const dynamic = "force-dynamic";

const ESC: Record<string, string> = {
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  "'": "&apos;",
  '"': "&quot;",
};
function esc(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ESC[c]);
}

export async function GET() {
  const feeds = await prisma.feed.findMany({
    // 신고로 가려진 글 제외(모더레이션 일관성).
    where: { status: "published", visibility: "public", hiddenAt: null },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { slug: true, title: true, summary: true, createdAt: true },
  });

  const items = feeds
    .map((f) => {
      const url = `${SITE_ORIGIN}/feed/${f.slug}`;
      const desc = f.summary?.trim()
        ? `\n      <description>${esc(f.summary.trim())}</description>`
        : "";
      return `    <item>
      <title>${esc(f.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${f.createdAt.toUTCString()}</pubDate>${desc}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>BY Playground</title>
    <link>${SITE_ORIGIN}</link>
    <description>생각과 기록을 남기는 개인 공간</description>
    <language>ko</language>
    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${SITE_ORIGIN}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
