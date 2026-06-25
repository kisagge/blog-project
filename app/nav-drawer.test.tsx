import { describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

vi.mock("@/app/theme-toggle", () => ({
  default: () => <div data-testid="theme-toggle" />,
}));
vi.mock("@/app/push-toggle", () => ({
  default: () => <div data-testid="push-toggle" />,
}));
vi.mock("@/app/actions/auth", () => ({ logout: vi.fn() }));

import NavDrawer from "@/app/nav-drawer";

function toggle() {
  return screen.getByRole("button", { name: "메뉴 열기" });
}

describe("NavDrawer", () => {
  test("닫힘: aria-expanded=false + 패널 inert", () => {
    const { container } = render(<NavDrawer session={null} />);
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    const panel = container.querySelector('[role="dialog"]')!;
    expect(panel).toHaveAttribute("inert");
  });

  test("열기: aria-expanded=true + inert 해제 + 공통 링크 노출", () => {
    const { container } = render(<NavDrawer session={null} />);
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(container.querySelector('[role="dialog"]')).not.toHaveAttribute(
      "inert",
    );
    for (const name of ["피드", "커뮤니티", "던파", "인기 글", "태그"])
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
  });

  test("anon: 로그인·가입 노출, 회원/관리자 메뉴 미노출", () => {
    render(<NavDrawer session={null} />);
    fireEvent.click(toggle());
    expect(screen.getByRole("link", { name: "로그인" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "가입" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "내 프로필" })).toBeNull();
    expect(screen.queryByRole("link", { name: "관리자" })).toBeNull();
  });

  test("member: 글쓰기·내 프로필·저장한 글·내 정보 + 로그아웃", () => {
    const { container } = render(
      <NavDrawer session={{ role: "member", nickname: "철수" }} />,
    );
    fireEvent.click(toggle());
    for (const name of ["글쓰기", "내 프로필", "저장한 글", "게임", "내 정보"])
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    const panel = within(container.querySelector('[role="dialog"]')!);
    expect(panel.getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "로그인" })).toBeNull();
  });

  test("admin: 관리자 링크 + 게임 + 로그아웃, 회원 전용 메뉴 미노출", () => {
    const { container } = render(<NavDrawer session={{ role: "admin" }} />);
    fireEvent.click(toggle());
    expect(screen.getByRole("link", { name: "관리자" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "게임" })).toBeInTheDocument();
    const panel = within(container.querySelector('[role="dialog"]')!);
    expect(panel.getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "글쓰기" })).toBeNull();
  });

  test("Escape 키로 닫힘", () => {
    render(<NavDrawer session={null} />);
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
  });
});
