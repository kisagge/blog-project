import { describe, expect, test } from "vitest";
import { spliceText, imageMarkdown, IMAGE_ALT_HINT } from "@/lib/textarea";

describe("spliceText", () => {
  test("커서 위치(빈 선택)에 삽입", () => {
    expect(spliceText("abcd", 2, 2, "X")).toBe("abXcd");
  });

  test("선택 영역을 치환", () => {
    expect(spliceText("abcd", 1, 3, "X")).toBe("aXd");
  });

  test("시작/끝 경계", () => {
    expect(spliceText("abc", 0, 0, "X")).toBe("Xabc");
    expect(spliceText("abc", 3, 3, "X")).toBe("abcX");
  });

  test("범위를 벗어난 인덱스는 클램프", () => {
    expect(spliceText("abc", -5, 99, "X")).toBe("X");
    expect(spliceText("abc", 99, 1, "X")).toBe("abcX"); // start>len → 끝에 삽입
  });

  test("빈 문자열에 삽입", () => {
    expect(spliceText("", 0, 0, "![](/uploads/a.png)")).toBe(
      "![](/uploads/a.png)",
    );
  });
});

describe("imageMarkdown", () => {
  test("업로드 이미지 마크다운 + 대체 텍스트 자리([ ] 안)의 캐럿 오프셋", () => {
    const { text, caret } = imageMarkdown("/uploads/a.png?w=4&h=2");
    expect(text).toBe("![](/uploads/a.png?w=4&h=2)\n");
    expect(text.slice(0, caret)).toBe("![");
    expect(text.slice(caret, caret + 1)).toBe("]");
  });

  test("안내 문구는 대체 텍스트 입력을 요청", () => {
    expect(IMAGE_ALT_HINT).toContain("대체 텍스트");
  });
});
