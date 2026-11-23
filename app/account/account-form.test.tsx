import { describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

// server-only 모듈을 끌어오지 않도록 액션을 모킹(클라 단위 테스트).
const MSG = "직접 업로드한 이미지만 아바타로 쓸 수 있습니다.";
vi.mock("@/app/account/actions", () => ({
  updateProfileAction: vi.fn(async () => ({ errors: { avatarUrl: [MSG] } })),
}));
import { updateProfileAction } from "@/app/account/actions";
vi.mock("@/app/account/avatar-action", () => ({ uploadAvatar: vi.fn() }));

import AccountForm from "@/app/account/account-form";

describe("AccountForm 아바타 서버 검증 에러", () => {
  test("저장 시 서버가 아바타를 거부하면 alert로 알리고 업로드 입력과 연결", async () => {
    render(<AccountForm email="a@x.com" nickname="닉" bio="" avatarUrl="" />);
    fireEvent.change(screen.getByLabelText("닉네임"), {
      target: { value: "새닉" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "저장" }));
    });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(MSG);
    expect(screen.getByLabelText("프로필 이미지 업로드")).toHaveAttribute(
      "aria-describedby",
      alert.id,
    );
  });
});

describe("AccountForm 필드 오류", () => {
  test("닉네임 오류는 role=alert + 입력 설명으로 연결", async () => {
    vi.mocked(updateProfileAction).mockResolvedValueOnce({
      errors: { nickname: ["이미 사용 중인 닉네임입니다."] },
    });
    render(<AccountForm email="a@x.com" nickname="닉" bio="" avatarUrl="" />);
    fireEvent.change(screen.getByLabelText("닉네임"), {
      target: { value: "새닉" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "저장" }));
    });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("이미 사용 중인 닉네임입니다.");
    const nick = screen.getByLabelText("닉네임");
    expect(nick).toHaveAttribute("aria-invalid", "true");
    expect(nick).toHaveAttribute("aria-describedby", alert.id);
  });
});
