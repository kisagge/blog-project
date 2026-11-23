import { describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/app/signup/actions", () => ({
  signup: vi.fn(async () => ({
    errors: { email: ["올바른 이메일을 입력하세요."] },
    values: { email: "bad", nickname: "새회원" },
  })),
}));

import SignupForm from "@/app/signup/signup-form";

describe("SignupForm 접근성", () => {
  test("비밀번호 규칙 안내가 비밀번호 입력의 설명으로 연결", () => {
    render(<SignupForm />);
    expect(screen.getByLabelText("비밀번호")).toHaveAccessibleDescription(
      /8자 이상/,
    );
  });

  test("필드 오류는 aria-invalid + aria-describedby + role=alert", async () => {
    render(<SignupForm />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "가입 신청" }));
    });
    const alert = await screen.findByRole("alert");
    const email = screen.getByLabelText("이메일");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAttribute("aria-describedby", alert.id);
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("닉네임")).not.toHaveAttribute("aria-invalid");
  });
});

describe("SignupForm 오류 후 입력 유지", () => {
  test("이메일·닉네임은 돌려받은 값으로 유지(비밀번호는 비움)", async () => {
    render(<SignupForm />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "가입 신청" }));
    });
    await screen.findByRole("alert");
    expect(screen.getByLabelText("이메일")).toHaveValue("bad");
    expect(screen.getByLabelText("닉네임")).toHaveValue("새회원");
    expect(screen.getByLabelText("비밀번호")).toHaveValue("");
  });
});
