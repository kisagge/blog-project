import { prisma } from "@/lib/prisma";
import { SITE_DESCRIPTION, SITE_NAME, SITE_ORIGIN } from "@/lib/share";
import { renderLlmsTxt } from "@/lib/llms-txt";
import { readHasAbout } from "@/lib/site-config";

// /llms.txt — AI 검색·에이전트용 사이트 안내(llmstxt.org). 요청 시 생성(빌드 타임 DB 접근 방지).
export const dynamic = "force-dynamic";

export async function GET() {
  // RSS·sitemap과 같은 공개 범위: 전체공개·게시·미숨김 글만.
  const [posts, about] = await Promise.all([
    prisma.feed.findMany({
      where: { status: "published", visibility: "public", hiddenAt: null },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { slug: true, title: true, summary: true },
    }),
    readHasAbout(),
  ]);

  const body = renderLlmsTxt({
    origin: SITE_ORIGIN,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    posts,
    hasAbout: about,
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
