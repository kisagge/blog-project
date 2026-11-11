import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/app/admin/upload-action", () => ({ uploadImage: vi.fn() }));

import FeedForm from "@/app/admin/feed-form";

const action = vi.fn();
beforeEach(() => {
  localStorage.clear();
  action.mockReset();
});

const KEY = "byjang-draft:admin:new";

describe("FeedForm 초안 자동저장(uncontrolled)", () => {
  test("입력 시 초안이 localStorage에 저장", async () => {
    const { container } = render(
      <FeedForm action={action} submitLabel="저장" />,
    );
    const ta = container.querySelector(
      'textarea[name="content"]',
    ) as HTMLTextAreaElement;
    fireEvent.input(ta, { target: { value: "관리자초안본문" } });
    await waitFor(() => expect(localStorage.getItem(KEY)).not.toBeNull(), {
      timeout: 1500,
    });
    expect(localStorage.getItem(KEY)).toContain("관리자초안본문");
  });

  test("저장된 초안이 있으면 복원 배너 → 복원 시 uncontrolled 필드 값 설정", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        savedAt: Date.now(),
        data: {
          title: "제목초안",
          slug: "",
          summary: "",
          content: "본문초안",
          visibility: "private",
          tags: "",
        },
      }),
    );
    const { container } = render(
      <FeedForm action={action} submitLabel="저장" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "복원" }));
    expect(
      (container.querySelector('input[name="title"]') as HTMLInputElement)
        .value,
    ).toBe("제목초안");
    expect(
      (
        container.querySelector(
          'textarea[name="content"]',
        ) as HTMLTextAreaElement
      ).value,
    ).toBe("본문초안");
  });
});

describe("FeedForm 접근성", () => {
  test("각 입력이 이름표와 연결(getByLabelText로 찾힘)", () => {
    render(<FeedForm action={action} submitLabel="저장" />);
    for (const [label, name] of [
      ["제목", "title"],
      ["slug (소문자·숫자·하이픈)", "slug"],
      ["요약 (선택)", "summary"],
      ["태그 (쉼표로 구분, 최대 5개)", "tags"],
      ["본문 (마크다운)", "content"],
    ])
      expect(screen.getByLabelText(label)).toHaveAttribute("name", name);
  });

  test("검증 오류는 aria-invalid + aria-describedby로 해당 입력에 연결", async () => {
    action.mockResolvedValue({ errors: { title: ["제목을 입력하세요."] } });
    render(<FeedForm action={action} submitLabel="저장" />);
    fireEvent.submit(screen.getByLabelText("제목").closest("form")!);
    const alert = await screen.findByRole("alert");
    const title = screen.getByLabelText("제목");
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(title).toHaveAttribute("aria-describedby", alert.id);
    expect(alert).toHaveTextContent("제목을 입력하세요.");
  });
});
