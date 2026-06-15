import { describe, expect, test } from "vitest";
import { xIntentUrl } from "@/lib/share";

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
