import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import ErrorFallback from "./error-fallback";

describe("ErrorFallback", () => {
  test("안내 문구와 홈 링크를 렌더한다", () => {
    render(<ErrorFallback retry={() => {}} />);
    expect(screen.getByText("문제가 발생했습니다")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    const home = screen.getByRole("link", { name: "홈으로" });
    expect(home).toHaveAttribute("href", "/");
  });

  test("다시 시도 클릭 시 retry를 호출한다", () => {
    const retry = vi.fn();
    render(<ErrorFallback retry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  test("digest가 있으면 오류 코드를 표시하고, 없으면 표시하지 않는다", () => {
    const { rerender } = render(
      <ErrorFallback retry={() => {}} digest="abc123" />,
    );
    expect(screen.getByText("오류 코드: abc123")).toBeInTheDocument();

    rerender(<ErrorFallback retry={() => {}} />);
    expect(screen.queryByText(/오류 코드:/)).not.toBeInTheDocument();
  });
});
