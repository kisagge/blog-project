"use client";
import { useId, useState } from "react";
import TabList, { panelId, tabId } from "@/app/ui/tab-list";

export type TabItem = { id: string; label: string; content: React.ReactNode };

// 캐릭터 상세 섹션 탭(장비·아바타·크리쳐 …). 선택된 패널만 렌더.
export default function Tabs({
  tabs,
  label,
}: {
  tabs: TabItem[];
  label: string;
}) {
  const prefix = useId();
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <div>
      <TabList
        label={label}
        prefix={prefix}
        tabs={tabs.map((t) => ({ key: t.id, label: t.label }))}
        active={current?.id ?? ""}
        onChange={setActive}
      />
      {current && (
        <div
          role="tabpanel"
          id={panelId(prefix, current.id)}
          aria-labelledby={tabId(prefix, current.id)}
          tabIndex={0}
          className="mt-6 flex flex-col gap-10"
        >
          {current.content}
        </div>
      )}
    </div>
  );
}
