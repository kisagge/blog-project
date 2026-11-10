import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// 서버 액션("use server" → server-only 체인) 격리.
vi.mock("@/app/admin/actions", () => ({
  saveAboutAction: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/app/admin/upload-action", () => ({ uploadImage: vi.fn() }));

import AboutEditor from "@/app/admin/about/about-editor";
import { saveAboutAction } from "@/app/admin/actions";
import { uploadImage } from "@/app/admin/upload-action";
import { ABOUT_MAX_LENGTH } from "@/lib/validation";

describe("AboutEditor", () => {
  test("초기값을 라벨 연결된 textarea에 채우고, 미리보기 탭은 공개 렌더러로 표시", () => {
    render(<AboutEditor initial={"## 안녕하세요\n\n소개 글"} />);
    const ta = screen.getByLabelText("소개 본문 (마크다운)");
    expect(ta).toHaveValue("## 안녕하세요\n\n소개 글");

    fireEvent.click(screen.getByRole("tab", { name: "미리보기" }));
    expect(
      screen.getByRole("heading", { level: 2, name: "안녕하세요" }),
    ).toBeInTheDocument();
    expect(document.getElementById("about-panel-write")).toHaveAttribute(
      "hidden",
    );
  });

  test("저장 → 액션에 본문 전달 + status로 완료 안내", async () => {
    render(<AboutEditor initial="" />);
    fireEvent.change(screen.getByLabelText("소개 본문 (마크다운)"), {
      target: { value: "새 소개" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(saveAboutAction).toHaveBeenCalled());
    const fd = vi.mocked(saveAboutAction).mock.calls[0][1];
    expect(fd.get("content")).toBe("새 소개");
    expect(await screen.findByText("저장했습니다.")).toBeInTheDocument();
  });

  test("길이 초과면 aria-invalid + 저장 버튼 비활성", () => {
    render(<AboutEditor initial={"x".repeat(ABOUT_MAX_LENGTH + 1)} />);
    expect(screen.getByLabelText("소개 본문 (마크다운)")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  test("이미지 첨부 → 업로드 URL을 마크다운 이미지로 삽입", async () => {
    vi.mocked(uploadImage).mockResolvedValue({
      url: "/uploads/me.png?w=1&h=1",
    });
    const { container } = render(<AboutEditor initial="" />);
    const input = container.querySelector('input[type="file"]')!;
    const file = new File(["x"], "me.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(screen.getByLabelText("소개 본문 (마크다운)")).toHaveValue(
        "![](/uploads/me.png?w=1&h=1)\n",
      ),
    );
  });
});
