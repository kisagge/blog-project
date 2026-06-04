import { render, screen } from "@testing-library/react";
import FeedNotFound from "./not-found";

describe("FeedNotFound", () => {
  test("안내 문구와 피드로 돌아가는 링크를 렌더한다", () => {
    render(<FeedNotFound />);
    expect(screen.getByText("글을 찾을 수 없습니다")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "피드로 돌아가기" });
    expect(link).toHaveAttribute("href", "/feed");
  });
});
