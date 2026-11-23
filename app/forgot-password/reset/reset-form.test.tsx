import { describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/app/forgot-password/actions", () => ({
  submitNewPassword: vi.fn(async () => ({
    errors: { confirm: ["비밀번호가 일치하지 않습니다."] },
  })),
}));

import ResetForm from "@/app/forgot-password/reset/reset-form";

describe("ResetForm 접근성", () => {
  test("규칙 안내는 새 비밀번호 설명, 확인 오류는 확인 입력에 연결", async () => {
    render(<ResetForm />);
    expect(screen.getByLabelText("새 비밀번호")).toHaveAccessibleDescription(
      /8자 이상/,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "비밀번호 변경" }));
    });
    const alert = await screen.findByRole("alert");
    const confirm = screen.getByLabelText("새 비밀번호 확인");
    expect(confirm).toHaveAttribute("aria-invalid", "true");
    expect(confirm).toHaveAttribute("aria-describedby", alert.id);
    expect(confirm).toHaveAttribute("autocomplete", "new-password");
  });
});
