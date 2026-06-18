import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// 서버 액션("use server" → server-only 체인) 격리.
vi.mock("@/app/account/posts/actions", () => ({ submitPost: vi.fn() }));

import PostEditor from "@/app/account/posts/post-editor";

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
