import { render } from "@testing-library/react";
import { highlightText } from "./highlight";

describe("highlightText", () => {
  test("매치를 <mark>로 감싼다(대소문자 무시)", () => {
    const { container } = render(<div>{highlightText("Hello World", "world")}</div>);
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe("World");
  });

  test("정규식 특수문자를 이스케이프해 리터럴로 매치(인젝션 방지)", () => {
    // 이스케이프 안 하면 '.'이 임의문자로 동작해 "a*b"도 매치됨 → 이스케이프로 1곳만.
    const { container } = render(<div>{highlightText("a.b a*b", "a.b")}</div>);
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe("a.b");
  });

  test("여러 토큰을 각각 강조", () => {
    const { container } = render(
      <div>{highlightText("사과 그리고 바나나", "사과 바나나")}</div>,
    );
    expect(container.querySelectorAll("mark")).toHaveLength(2);
  });

  test("빈/1자 쿼리는 평문(mark 없음)", () => {
    const { container } = render(<div>{highlightText("내용입니다", "")}</div>);
    expect(container.querySelectorAll("mark")).toHaveLength(0);
    expect(container.textContent).toBe("내용입니다");
  });
});
