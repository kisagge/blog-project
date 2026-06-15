import { describe, expect, test } from "vitest";
import {
  xIntentUrl,
  absoluteUrl,
  toAbsolute,
  firstContentImage,
  SITE_ORIGIN,
} from "@/lib/share";

describe("toAbsolute / firstContentImage", () => {
  test("toAbsolute: 절대 URL은 그대로, 상대는 절대화", () => {
    expect(toAbsolute("https://x.com/a.png")).toBe("https://x.com/a.png");
    expect(toAbsolute("/uploads/a.png")).toBe(`${SITE_ORIGIN}/uploads/a.png`);
  });
  test("firstContentImage: 마크다운/HTML 첫 이미지, 없으면 null", () => {
    expect(firstContentImage("글 ![alt](/uploads/x.png) 끝")).toBe(
      "/uploads/x.png",
    );
    expect(firstContentImage('<p><img src="https://y/z.jpg"></p>')).toBe(
      "https://y/z.jpg",
    );
    expect(firstContentImage("이미지 없는 본문")).toBeNull();
  });
});

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
