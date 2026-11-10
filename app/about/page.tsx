import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAbout } from "@/lib/site-config";
import { stripMarkdown } from "@/lib/content";
import { isoInstant, kstDate } from "@/lib/kst";
import { buildAboutJsonLd, jsonLdHtml } from "@/lib/structured-data";
import MarkdownContent from "@/app/markdown-content";

// 런타임 DB 조회(관리자 편집 즉시 반영).
export const dynamic = "force-dynamic";

// 메타 설명·JSON-LD용 평문 요약(검색 결과 스니펫 길이).
function describe(content: string): string {
  return stripMarkdown(content).replace(/\s+/g, " ").trim().slice(0, 150);
}

export async function generateMetadata(): Promise<Metadata> {
  const about = await getAbout();
  return {
    title: "소개",
    description: about ? describe(about.content) : undefined,
    alternates: { canonical: "/about" },
  };
}

// 관리자가 /admin/about에서 편집하는 소개 페이지. 본문이 비어 있으면 404(내비 링크도 숨김).
export default async function AboutPage() {
  const about = await getAbout();
  if (!about) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <article>
        <header className="mb-8 border-b border-black/[.06] pb-6 dark:border-white/[.1]">
          <h1 className="text-3xl font-semibold tracking-tight">소개</h1>
          {about.updatedAt && (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              마지막 수정{" "}
              <time dateTime={isoInstant(about.updatedAt)}>
                {kstDate(about.updatedAt)}
              </time>
            </p>
          )}
        </header>
        <MarkdownContent content={about.content} />
      </article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml(
            buildAboutJsonLd({
              description: describe(about.content),
              updatedAt: about.updatedAt,
            }),
          ),
        }}
      />
    </main>
  );
}
