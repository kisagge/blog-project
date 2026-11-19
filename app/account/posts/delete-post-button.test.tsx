import { describe, expect, test, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

const deleteMyPostAction = vi.fn(async (_fd: FormData) => {});
vi.mock("@/app/account/posts/actions", () => ({
  deleteMyPostAction: (fd: FormData) => deleteMyPostAction(fd),
}));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import DeletePostButton from "@/app/account/posts/delete-post-button";

// jsdom은 <dialog>.showModal/close를 구현하지 않음 → open 속성 토글로 대체
beforeEach(() => {
  deleteMyPostAction.mockClear();
  push.mockClear();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});

describe("DeletePostButton", () => {
  test("트리거 이름에 글 제목 포함(목록에서 어떤 글인지 구별)", () => {
    render(<DeletePostButton id="p1" title="첫 글" kind="post" />);
    expect(
      screen.getByRole("button", { name: "‘첫 글’ 삭제" }),
    ).toBeInTheDocument();
  });

  test("누르면 바로 지우지 않고 확인창 — 게시 글은 댓글도 함께 지워짐을 안내", () => {
    render(<DeletePostButton id="p1" title="첫 글" kind="post" />);
    fireEvent.click(screen.getByRole("button", { name: "‘첫 글’ 삭제" }));
    expect(deleteMyPostAction).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "글을 삭제할까요?" });
    expect(dialog).toHaveTextContent("달린 댓글");
  });

  test("취소하면 삭제하지 않음", () => {
    render(<DeletePostButton id="p1" title="첫 글" kind="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "‘첫 글’ 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(deleteMyPostAction).not.toHaveBeenCalled();
  });

  test("확인하면 해당 id로 삭제, redirectTo가 있으면 이동", async () => {
    render(
      <DeletePostButton
        id="p9"
        title="상세 글"
        kind="post"
        redirectTo="/account/posts"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "‘상세 글’ 삭제" }));
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "삭제" }).at(-1)!);
    });
    expect(deleteMyPostAction).toHaveBeenCalledTimes(1);
    expect(deleteMyPostAction.mock.calls[0][0].get("id")).toBe("p9");
    expect(push).toHaveBeenCalledWith("/account/posts");
  });
});
