import { describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

// server-only 모듈을 끌어오지 않도록 액션을 모킹(클라 단위 테스트).
const MSG = "직접 업로드한 이미지만 아바타로 쓸 수 있습니다.";
vi.mock("@/app/account/actions", () => ({
  updateProfileAction: vi.fn(async () => ({ errors: { avatarUrl: [MSG] } })),
}));
import { updateProfileAction } from "@/app/account/actions";
vi.mock("@/app/account/avatar-action", () => ({ uploadAvatar: vi.fn() }));
import { uploadAvatar } from "@/app/account/avatar-action";
import { PNG_1x1 } from "@/test/helpers";

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

describe("AccountForm 아바타 업로드 실패 복구", () => {
  const pick = (file: File) =>
    fireEvent.change(screen.getByLabelText("프로필 이미지 업로드"), {
      target: { files: [file] },
    });

  test("업로드 요청이 예외로 끝나도 업로드 입력이 다시 활성화되고 오류 안내", async () => {
    vi.mocked(uploadAvatar).mockRejectedValueOnce(new Error("network"));
    render(<AccountForm email="a@x.com" nickname="닉" bio="" avatarUrl="" />);
    await act(async () => {
      pick(new File([PNG_1x1], "a.png", { type: "image/png" }));
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "업로드에 실패했습니다",
    );
    expect(screen.getByLabelText("프로필 이미지 업로드")).not.toBeDisabled();
  });

  test("형식이 맞지 않으면 서버에 보내지 않고 바로 안내(본문 크기 한도 초과로 멈추는 것 방지)", async () => {
    vi.mocked(uploadAvatar).mockClear();
    render(<AccountForm email="a@x.com" nickname="닉" bio="" avatarUrl="" />);
    await act(async () => {
      pick(new File(["x"], "a.gif", { type: "image/gif" }));
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("jpg/png/webp");
    expect(uploadAvatar).not.toHaveBeenCalled();
  });
});
