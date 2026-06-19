import { absoluteUrl, SITE_NAME, SITE_DESCRIPTION } from "@/lib/share";
import { isoInstant } from "@/lib/kst";

// 글 상세용 schema.org 구조화 데이터(JSON-LD) 빌더. 순수 모듈 — 서버 컴포넌트에서 사용.
// 전체공개·게시 글에만 주입(호출부 게이팅). 검색 리치 스니펫(작성자·날짜·breadcrumb)용.

type FeedForJsonLd = {
  slug: string;
  title: string;
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  authorId: string | null; // null = 관리자 글(프로필 링크 없음)
  feedTags: { tag: { name: string } }[];
};

export function buildFeedJsonLd(
  feed: FeedForJsonLd,
  authorName: string,
): object {
  const url = absoluteUrl(`/feed/${feed.slug}`);
  const author = feed.authorId
    ? {
        "@type": "Person",
        name: authorName,
        url: absoluteUrl(`/u/${feed.authorId}`),
      }
    : { "@type": "Person", name: authorName };

  const blogPosting: Record<string, unknown> = {
    "@type": "BlogPosting",
    headline: feed.title,
    url,
    mainEntityOfPage: url,
    datePublished: isoInstant(feed.publishedAt ?? feed.createdAt),
    dateModified: isoInstant(feed.updatedAt),
    author,
    image: absoluteUrl(`/feed/${feed.slug}/opengraph-image`), // 동적 OG 1200×630
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/icons/icon-512.png"),
      },
    },
    inLanguage: "ko-KR",
  };
  const summary = feed.summary?.trim();
  if (summary) blogPosting.description = summary;
  const keywords = feed.feedTags.map((ft) => ft.tag.name).filter(Boolean);
  if (keywords.length) blogPosting.keywords = keywords.join(", ");

  const breadcrumb = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: absoluteUrl("/") },
      {
        "@type": "ListItem",
        position: 2,
        name: "피드",
        item: absoluteUrl("/feed"),
      },
      { "@type": "ListItem", position: 3, name: feed.title, item: url },
    ],
  };

  return {
    "@context": "https://schema.org",
    "@graph": [blogPosting, breadcrumb],
  };
}

// 홈용 사이트 식별 JSON-LD(WebSite + Organization). 홈에서 1회 주입.
// WebSite.potentialAction(SearchAction)로 구글 사이트링크 검색창 후보 제공(/feed?q=).
export function buildSiteJsonLd(): object {
  const orgId = absoluteUrl("/#organization");
  const org = {
    "@type": "Organization",
    "@id": orgId,
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: { "@type": "ImageObject", url: absoluteUrl("/icons/icon-512.png") },
  };
  const website = {
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: SITE_NAME,
    url: absoluteUrl("/"),
    description: SITE_DESCRIPTION,
    inLanguage: "ko-KR",
    publisher: { "@id": orgId },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absoluteUrl("/feed?q={search_term_string}"),
      },
      "query-input": "required name=search_term_string",
    },
  };
  return { "@context": "https://schema.org", "@graph": [website, org] };
}

// JSON-LD를 <script> 안에 넣기 위한 직렬화. '<'를 유니코드 이스케이프해
// 제목/요약에 "</script>"가 있어도 마크업이 깨지거나 주입되지 않게 한다.
export function jsonLdHtml(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
