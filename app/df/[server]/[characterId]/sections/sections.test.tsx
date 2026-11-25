import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { EquipmentSection } from "@/app/df/[server]/[characterId]/sections/gear";
import { TimelineSection } from "@/app/df/[server]/[characterId]/sections/timeline";
import { characterTabs } from "@/app/df/[server]/[characterId]/character-tabs";

describe("던파 상세 섹션", () => {
  test('아이템 이미지는 바로 옆에 이름이 있어 장식용(alt="") — 이름을 두 번 읽지 않게', () => {
    const { container } = render(
      <EquipmentSection
        items={[
          {
            slotId: "WEAPON",
            slotName: "무기",
            itemId: "i1",
            itemName: "검은 검",
            itemRarity: "에픽",
            reinforce: 12,
          } as never,
        ]}
      />,
    );
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
    expect(screen.getByText("검은 검")).toBeInTheDocument();
    expect(screen.getByText("+12 강화")).toBeInTheDocument();
  });

  test("최근 활동 시각은 <time datetime>", () => {
    const { container } = render(
      <TimelineSection
        rows={[{ code: 1, name: "아이템 획득", date: "2026-11-20 21:05" }]}
      />,
    );
    expect(container.querySelector("time")).toHaveAttribute(
      "datetime",
      "2026-11-20T21:05+09:00",
    );
  });
});

describe("characterTabs", () => {
  const empty = {
    status: { status: [] },
    equipment: { items: [], sets: [] },
    avatar: [],
    creature: null,
    timeline: [],
    skill: null,
    oath: null,
    mist: null,
    buff: null,
  } as never;

  test("데이터가 있는 그룹만 탭으로", () => {
    expect(characterTabs(empty).map((t) => t.id)).toEqual([]);
    const some = {
      ...(empty as object),
      status: { status: [{ name: "힘", value: 1 }] },
      timeline: [{ code: 1, name: "x", date: "2026-11-20 21:05" }],
      creature: { itemId: "c", itemName: "크리쳐", itemRarity: "레어" },
    } as never;
    expect(characterTabs(some).map((t) => t.id)).toEqual([
      "stat",
      "avatar",
      "timeline",
    ]);
  });
});
