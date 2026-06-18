import { describe, expect, test } from "vitest";
import {
  readingTimeMinutes,
  extractToc,
  makeSnippet,
  stripMarkdown,
} from "@/lib/content";

describe("readingTimeMinutes", () => {
  test("빈/공백은 최소 1분", () => {
    expect(readingTimeMinutes("")).toBe(1);
    expect(readingTimeMinutes("   \n\n")).toBe(1);
  });

  test("500자=1분, 501자=2분(비공백 글자수 ÷ 500, 올림)", () => {
    expect(readingTimeMinutes("가".repeat(500))).toBe(1);
    expect(readingTimeMinutes("가".repeat(501))).toBe(2);
    expect(readingTimeMinutes("가".repeat(1000))).toBe(2);
  });

  test("마크다운 기호·코드블록은 카운트 제외", () => {
    // 코드블록 600자 + 본문 100자 → 본문만 카운트 → 1분
    const body = "내".repeat(100);
    const code = "```\n" + "x".repeat(600) + "\n```";
    expect(readingTimeMinutes(`${code}\n${body}`)).toBe(1);
    // 제목/강조/링크 기호 제외
    expect(readingTimeMinutes("## **굵게** [링크](http://x)")).toBe(1);
  });
});

describe("extractToc", () => {
  test("h2/h3 추출, 슬러그 생성", () => {
    const toc = extractToc("## 소개\n\n본문\n\n### 세부");
    expect(toc).toEqual([
      { depth: 2, text: "소개", slug: "소개" },
      { depth: 3, text: "세부", slug: "세부" },
    ]);
  });

  test("코드펜스 안의 #은 목차 제외", () => {
    const toc = extractToc("## 진짜\n```\n## 가짜\n```\n### 진짜2");
    expect(toc.map((t) => t.text)).toEqual(["진짜", "진짜2"]);
  });

  test("h1·h4는 제외(본문 h2~h3만)", () => {
    const toc = extractToc("# 제목\n## 둘\n#### 넷");
    expect(toc.map((t) => t.depth)).toEqual([2]);
  });

  test("중복 제목은 슬러그 dedup", () => {
    const toc = extractToc("## 같음\n## 같음");
    expect(toc.map((t) => t.slug)).toEqual(["같음", "같음-1"]);
  });

  test("인라인 마크다운은 text·slug에서 제거", () => {
    const toc = extractToc("## **굵게** `코드`");
    expect(toc[0].text).toBe("굵게 코드");
    expect(toc[0].slug).toBe("굵게-코드");
  });
});

describe("stripMarkdown", () => {
  test("코드블록·기호·링크를 평문으로", () => {
    expect(stripMarkdown("# 제목\n**굵게** [링크](http://x)")).toContain("제목");
    expect(stripMarkdown("```\ncode\n```\n본문")).not.toContain("code");
    const s = stripMarkdown("**굵게** `코드`");
    expect(s).not.toContain("*");
    expect(s).not.toContain("`");
  });
});

describe("makeSnippet", () => {
  test("매치 토큰을 중심으로 발췌하고 앞뒤를 …로 자른다", () => {
    const content = "가".repeat(100) + "찾는단어" + "나".repeat(100);
    const s = makeSnippet(content, ["찾는단어"], 10);
    expect(s).toContain("찾는단어");
    expect(s.startsWith("…")).toBe(true);
    expect(s.endsWith("…")).toBe(true);
    expect(s.length).toBeLessThan(content.length);
  });

  test("매치가 없으면 본문 앞부분으로 폴백", () => {
    const content = "처음부터" + "라".repeat(300);
    const s = makeSnippet(content, ["없는단어"], 60);
    expect(s.startsWith("처음부터")).toBe(true);
    expect(s.endsWith("…")).toBe(true);
  });

  test("마크다운 기호는 제거된 평문으로 발췌", () => {
    const s = makeSnippet("**굵게** 찾기쉬운 `코드`", ["찾기쉬운"]);
    expect(s).toContain("찾기쉬운");
    expect(s).not.toContain("*");
    expect(s).not.toContain("`");
  });

  test("빈 본문은 빈 문자열", () => {
    expect(makeSnippet("", ["x"])).toBe("");
  });
});
