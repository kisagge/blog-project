import { render, screen } from "@testing-library/react";
import PrevNextNav from "@/app/feed/prev-next-nav";

describe("PrevNextNav", () => {
  test("prev·next 링크를 올바른 href·라벨로 렌더", () => {
    render(
      <PrevNextNav
        prev={{ slug: "older", title: "이전제목" }}
        next={{ slug: "newer", title: "다음제목" }}
      />,
    );
    expect(screen.getByRole("link", { name: /이전제목/ })).toHaveAttribute(
      "href",
      "/feed/older",
    );
    expect(screen.getByRole("link", { name: /다음제목/ })).toHaveAttribute(
      "href",
      "/feed/newer",
    );
  });

  test("한쪽이 null이면 그쪽은 렌더 안 함", () => {
    render(
      <PrevNextNav prev={null} next={{ slug: "newer", title: "다음제목" }} />,
    );
    expect(screen.queryByText("← 이전 글")).toBeNull();
    expect(screen.getByText("다음 글 →")).toBeInTheDocument();
  });

  test("둘 다 null이면 아무것도 안 그림", () => {
    const { container } = render(<PrevNextNav prev={null} next={null} />);
    expect(container.firstChild).toBeNull();
  });
});
