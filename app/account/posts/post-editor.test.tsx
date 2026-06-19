import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// 서버 액션("use server" → server-only 체인) 격리.
vi.mock("@/app/account/posts/actions", () => ({ submitPost: vi.fn() }));
vi.mock("@/app/account/posts/image-action", () => ({
  uploadPostImage: vi.fn(),
}));

import PostEditor from "@/app/account/posts/post-editor";
import { uploadPostImage } from "@/app/account/posts/image-action";

beforeEach(() => localStorage.clear());

describe("PostEditor 미리보기", () => {
  test("미리보기 탭이 본문 마크다운을 렌더하고 작성 패널은 숨김", () => {
    render(<PostEditor />);
    const ta = screen.getByLabelText("본문 (마크다운)");
    fireEvent.change(ta, { target: { value: "# 미리보기제목" } });

    fireEvent.click(screen.getByRole("tab", { name: "미리보기" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "미리보기제목" }),
    ).toBeInTheDocument();
    // textarea를 담은 작성 패널은 hidden(폼 제출 위해 마운트는 유지)
    expect(document.getElementById("panel-write")).toHaveAttribute("hidden");
  });

  test("빈 본문이면 미리보기에 안내 문구", () => {
    render(<PostEditor />);
    fireEvent.click(screen.getByRole("tab", { name: "미리보기" }));
    expect(screen.getByText("미리볼 내용이 없습니다.")).toBeInTheDocument();
  });

  test("마크다운 도움말이 접이식으로 제공된다", () => {
    render(<PostEditor />);
    expect(screen.getByText("마크다운 작성 도움말")).toBeInTheDocument();
  });
});

describe("PostEditor 이미지 업로드", () => {
  test("이미지 첨부 → 업로드 성공 시 본문에 마크다운 삽입", async () => {
    vi.mocked(uploadPostImage).mockResolvedValue({
      url: "/uploads/x.png?w=4&h=2",
    });
    render(<PostEditor />);
    const ta = screen.getByLabelText("본문 (마크다운)") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "앞" } });
    ta.selectionStart = ta.selectionEnd = 1; // 커서를 '앞' 뒤로

    const file = new File([new Uint8Array([1, 2, 3])], "x.png", {
      type: "image/png",
    });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(uploadPostImage).toHaveBeenCalled());
    await waitFor(() =>
      expect(ta.value).toBe("앞![](/uploads/x.png?w=4&h=2)\n"),
    );
  });

  test("비이미지 파일은 업로드 호출 없이 오류 표시", async () => {
    vi.mocked(uploadPostImage).mockClear();
    render(<PostEditor />);
    const file = new File(["text"], "a.txt", { type: "text/plain" });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("jpg/png/webp");
    expect(uploadPostImage).not.toHaveBeenCalled();
  });
});

describe("PostEditor 초안 자동저장", () => {
  const KEY = "byjang-draft:member:new";

  test("타이핑하면 초안이 localStorage에 저장(디바운스)", async () => {
    render(<PostEditor />);
    fireEvent.change(screen.getByLabelText("본문 (마크다운)"), {
      target: { value: "자동저장본문" },
    });
    await waitFor(() => expect(localStorage.getItem(KEY)).not.toBeNull(), {
      timeout: 1500,
    });
    expect(localStorage.getItem(KEY)).toContain("자동저장본문");
  });

  test("저장된 초안이 있으면 복원 배너 → 복원 시 본문 채움", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        savedAt: Date.now(),
        data: { title: "초안제목", content: "초안본문", tags: "" },
      }),
    );
    render(<PostEditor />);
    fireEvent.click(screen.getByRole("button", { name: "복원" }));
    expect(
      (screen.getByLabelText("본문 (마크다운)") as HTMLTextAreaElement).value,
    ).toBe("초안본문");
  });

  test("제출 시 초안 삭제", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        savedAt: Date.now(),
        data: { title: "t", content: "c", tags: "" },
      }),
    );
    const { container } = render(<PostEditor />);
    fireEvent.submit(container.querySelector("form")!);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
