import { describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/app/account/withdraw/actions", () => ({
  withdrawAction: vi.fn(async () => ({
    errors: { password: ["비밀번호가 올바르지 않습니다."] },
  })),
}));

import WithdrawForm from "@/app/account/withdraw/withdraw-form";

describe("WithdrawForm 접근성", () => {
  test("비밀번호 안내·오류가 입력 설명으로 연결, 선택지는 이름표와 연결", async () => {
    render(<WithdrawForm />);
    expect(
      screen.getByRole("checkbox", { name: /내가 쓴 글도 함께 삭제/ }),
    ).toBeInTheDocument();
    const pw = screen.getByLabelText("비밀번호 확인");
    expect(pw).toHaveAttribute("autocomplete", "current-password");
    fireEvent.change(pw, { target: { value: "x" } });
    await act(async () => {
      fireEvent.submit(pw.closest("form")!);
    });
    await screen.findByRole("alert");
    expect(pw).toHaveAttribute("aria-invalid", "true");
    expect(pw).toHaveAccessibleDescription(/비밀번호가 올바르지 않습니다/);
  });
});
