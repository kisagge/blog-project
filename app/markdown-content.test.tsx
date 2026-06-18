import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import MarkdownContent from "@/app/markdown-content";

describe("MarkdownContent", () => {
  test("제목·강조·링크·목록을 올바른 HTML로 렌더", () => {
    render(
      <MarkdownContent
        content={
          "# 큰제목\n\n**굵게** 그리고 [링크](https://example.com)\n\n- 첫\n- 둘"
        }
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "큰제목" }),
    ).toBeInTheDocument();
    expect(screen.getByText("굵게").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "링크" })).toHaveAttribute(
      "href",
      "https://example.com",
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  test("raw HTML은 이스케이프되어 실행 요소로 들어가지 않음(XSS 안전)", () => {
    const { container } = render(
      <MarkdownContent content={"<script>alert(1)</script> 안녕"} />,
    );
    expect(container.querySelector("script")).toBeNull();
  });

  test("펜스 코드블록을 hljs로 하이라이트(토큰 span 생성)", () => {
    const { container } = render(
      <MarkdownContent content={"```js\nconst x = 1;\n```"} />,
    );
    const code = container.querySelector("pre code.hljs");
    expect(code).not.toBeNull();
    // highlight.js가 키워드 등 토큰을 span으로 감쌈.
    expect(container.querySelector("pre code .hljs-keyword")).not.toBeNull();
  });
});
