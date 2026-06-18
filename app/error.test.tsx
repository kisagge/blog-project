import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import ErrorPage from "./error";

// 래퍼가 unstable_retry → 폴백 retry로 올바로 연결되는지 고정(이름 바뀌면 회복 버튼이 무동작).
describe("Error (루트 바운더리)", () => {
  test("다시 시도 클릭 시 unstable_retry를 호출하고 digest를 노출한다", () => {
    const retry = vi.fn();
    const error = Object.assign(new Error("boom"), { digest: "d1" });
    render(<ErrorPage error={error} unstable_retry={retry} />);

    expect(screen.getByText("오류 코드: d1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
