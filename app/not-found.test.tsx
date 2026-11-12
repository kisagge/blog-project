import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import NotFound from "@/app/not-found";

describe("사이트 404", () => {
  test("main 랜드마크 + h1 + 이동 링크(nav)", () => {
    render(<NotFound />);
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "페이지를 찾을 수 없습니다",
      }),
    ).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "다른 곳으로 이동" });
    expect(nav).toContainElement(screen.getByRole("link", { name: "홈" }));
  });
});
