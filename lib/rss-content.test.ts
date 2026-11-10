import { describe, expect, test } from "vitest";
import { markdownToFeedHtml } from "@/lib/rss-content";

const ORIGIN = "https://example.com";

describe("markdownToFeedHtml", () => {
  test("GFM 마크다운 → HTML(표·취소선 포함)", async () => {
    const html = await markdownToFeedHtml(
      "## 제목\n\n**굵게** ~~취소~~\n\n| a |\n|---|\n| 1 |",
      ORIGIN,
    );
    expect(html).toContain("<h2>제목</h2>");
    expect(html).toContain("<strong>굵게</strong>");
    expect(html).toContain("<del>취소</del>");
    expect(html).toContain("<table>");
  });

  test("raw HTML·스크립트는 제거(XSS 안전, 화면 렌더러와 동일 정책)", async () => {
    const html = await markdownToFeedHtml(
      '<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n본문',
      ORIGIN,
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).toContain("본문");
  });

  test("사이트 상대 경로(이미지·링크)는 절대 URL로 — RSS 리더는 사이트 밖에서 렌더", async () => {
    const html = await markdownToFeedHtml(
      "![사진](/uploads/a.jpg?w=10&h=20) [다른 글](/feed/other) [외부](https://x.dev)",
      ORIGIN,
    );
    expect(html).toContain(
      'src="https://example.com/uploads/a.jpg?w=10&#x26;h=20"',
    );
    expect(html).toContain('alt="사진"');
    expect(html).toContain('href="https://example.com/feed/other"');
    expect(html).toContain('href="https://x.dev"');
  });

  test("콜아웃은 제목 문단이 붙은 블록으로 변환(리더에서도 종류가 보이게)", async () => {
    const html = await markdownToFeedHtml("> [!TIP]\n> 내용", ORIGIN);
    expect(html).toContain('<p class="md-callout-title">팁</p>');
    expect(html).not.toContain("[!TIP]");
  });
});
