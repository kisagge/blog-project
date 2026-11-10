// /llms.txt(https://llmstxt.org) 본문 생성. 순수 함수 — AI 검색·에이전트가 사이트 구조와 주요 글을 빠르게 파악하도록
// H1 사이트명 → 인용 요약 → H2 섹션별 링크 목록의 마크다운을 만든다. 전체공개 글만 넘겨받는다(호출부 게이팅).

type Post = { slug: string; title: string; summary: string | null };

// 링크 텍스트 안의 대괄호는 마크다운 링크 문법을 깨므로 이스케이프.
const linkText = (s: string) => s.replace(/[[\]]/g, (c) => `\\${c}`);
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

export function renderLlmsTxt(opts: {
  origin: string;
  name: string;
  description: string;
  posts: Post[];
  hasAbout?: boolean; // 소개 본문이 있을 때만 소개 링크(없으면 404)
}): string {
  const { origin } = opts;
  const pages: [string, string, string][] = [
    ...(opts.hasAbout
      ? [["소개", "/about", "블로그와 운영자 소개"] as [string, string, string]]
      : []),
    ["피드", "/feed", "블로그 글 목록(최신순, 검색·태그 필터)"],
    ["아카이브", "/archive", "모든 글을 연·월별로"],
    ["시리즈", "/series", "순서가 있는 연재 모음"],
    ["태그", "/feed/tags", "주제별 태그와 글 수"],
    ["인기 글", "/feed/popular", "조회수 상위 글"],
    ["RSS", "/rss.xml", "최근 글 본문 전문 포함 피드"],
  ];
  const out = [
    `# ${opts.name}`,
    "",
    `> ${oneLine(opts.description)}`,
    "",
    "## 주요 페이지",
    "",
    ...pages.map(([t, p, d]) => `- [${t}](${origin}${p}): ${d}`),
  ];
  if (opts.posts.length > 0) {
    out.push(
      "",
      "## 최근 글",
      "",
      ...opts.posts.map((p) => {
        const link = `- [${linkText(p.title)}](${origin}/feed/${p.slug})`;
        const summary = p.summary ? oneLine(p.summary) : "";
        return summary ? `${link}: ${summary}` : link;
      }),
    );
  }
  return out.join("\n") + "\n";
}
