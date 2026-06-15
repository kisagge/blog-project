import { describe, expect, test } from "vitest";
import { xIntentUrl, absoluteUrl, SITE_ORIGIN } from "@/lib/share";

describe("absoluteUrl", () => {
  test("운영 도메인 기준 절대 URL 생성(앞 슬래시 유무 무관)", () => {
    expect(absoluteUrl("/feed/abc")).toBe(`${SITE_ORIGIN}/feed/abc`);
    expect(absoluteUrl("df/cain/x")).toBe(`${SITE_ORIGIN}/df/cain/x`);
  });
});

describe("xIntentUrl", () => {
  test("url·text를 인코딩해 X 인텐트 URL 생성", () => {
    const out = xIntentUrl("https://by-jang-blog.xyz/feed/안녕", "제목 & 글");
    expect(out).toContain("https://twitter.com/intent/tweet?");
    expect(out).toContain(
      "url=" + encodeURIComponent("https://by-jang-blog.xyz/feed/안녕"),
    );
    expect(out).toContain("text=" + encodeURIComponent("제목 & 글"));
  });
});
