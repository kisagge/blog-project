import { describe, expect, test } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import KstTime from "@/app/ui/kst-time";
import AuthorName from "@/app/ui/author-name";
import LinkTabs from "@/app/ui/link-tabs";
import Tabs from "@/app/df/[server]/[characterId]/tabs";
import { kstDateTime } from "@/lib/kst";

describe("KstTime", () => {
  test("기계용 dateTime(UTC ISO) + KST 날짜, withTime이면 시각까지", () => {
    const d = "2026-11-22T15:30:00.000Z"; // KST 11-23 00:30
    const { container, rerender } = render(<KstTime value={d} />);
    const t = container.querySelector("time")!;
    expect(t).toHaveAttribute("datetime", d);
    expect(t.textContent).toBe("2026. 11. 23.");
    rerender(<KstTime value={d} withTime className="text-xs" />);
    expect(container.querySelector("time")!.textContent).toBe(kstDateTime(d));
    expect(container.querySelector("time")).toHaveClass("text-xs");
  });
});

describe("AuthorName", () => {
  test("id가 있고 link면 프로필 링크, 아니면 텍스트", () => {
    const { rerender } = render(<AuthorName id="u1" name="회원A" link />);
    expect(screen.getByRole("link", { name: "회원A" })).toHaveAttribute(
      "href",
      "/u/u1",
    );
    rerender(<AuthorName id="u1" name="회원A" link={false} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("회원A")).toBeInTheDocument();
    rerender(<AuthorName id={null} name="관리자" link />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("LinkTabs", () => {
  test("nav 랜드마크 + 현재 탭에 aria-current=page", () => {
    render(
      <LinkTabs
        label="회원 관리"
        tabs={[
          { href: "/a", label: "가입 대기 (2)", active: true },
          { href: "/b", label: "회원 (5)", active: false },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "회원 관리" });
    expect(
      within(nav).getByRole("link", { name: "가입 대기 (2)" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(nav).getByRole("link", { name: "회원 (5)" }),
    ).not.toHaveAttribute("aria-current");
  });
});

describe("던파 상세 Tabs(ARIA 탭)", () => {
  const tabs = [
    { id: "eq", label: "장비", content: <p>장비 내용</p> },
    { id: "av", label: "아바타", content: <p>아바타 내용</p> },
    { id: "cr", label: "크리쳐", content: <p>크리쳐 내용</p> },
  ];

  test("tablist/tab/tabpanel 연결 + 선택 상태", () => {
    render(<Tabs tabs={tabs} label="캐릭터 정보" />);
    const list = screen.getByRole("tablist", { name: "캐릭터 정보" });
    const [eq, av] = within(list).getAllByRole("tab");
    expect(eq).toHaveAttribute("aria-selected", "true");
    expect(av).toHaveAttribute("aria-selected", "false");
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveTextContent("장비 내용");
    expect(panel).toHaveAttribute("aria-labelledby", eq.id);
    expect(eq).toHaveAttribute("aria-controls", panel.id);
    fireEvent.click(av);
    expect(av).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("아바타 내용");
  });

  test("방향키·Home/End로 이동하며 선택, 선택된 탭만 Tab 순서(tabIndex 0)", () => {
    render(<Tabs tabs={tabs} label="캐릭터 정보" />);
    const [eq, av, cr] = screen.getAllByRole("tab");
    expect(eq).toHaveAttribute("tabindex", "0");
    expect(av).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(eq, { key: "ArrowRight" });
    expect(av).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(av);
    fireEvent.keyDown(av, { key: "End" });
    expect(cr).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(cr, { key: "ArrowRight" }); // 끝에서 처음으로 순환
    expect(eq).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(eq, { key: "ArrowLeft" });
    expect(cr).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(cr, { key: "Home" });
    expect(eq).toHaveAttribute("aria-selected", "true");
  });
});
