import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import Pager, { parsePage } from "@/app/ui/pager";

describe("Pager", () => {
  test("이름 있는 페이지 이동 랜드마크 + 이전/다음 링크·현재 위치", () => {
    render(
      <Pager page={2} total={70} pageSize={30} basePath="/notifications" />,
    );
    const nav = screen.getByRole("navigation", { name: "페이지 이동" });
    expect(screen.getByRole("link", { name: "이전" })).toHaveAttribute(
      "href",
      "/notifications",
    );
    expect(screen.getByRole("link", { name: "다음" })).toHaveAttribute(
      "href",
      "/notifications?page=3",
    );
    expect(nav).toHaveTextContent("2 / 3");
  });

  test("한 페이지뿐이면 그리지 않음, page 파싱은 1 이상 정수", () => {
    const { container } = render(
      <Pager page={1} total={5} pageSize={30} basePath="/x" />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(parsePage("3")).toBe(3);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("abc")).toBe(1);
  });
});
