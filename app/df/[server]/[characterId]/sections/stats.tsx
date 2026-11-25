import type { DfStat } from "@/lib/neople";
import { Section, StatGrid } from "./common";

// 주요 능력치만 이 순서로 표시(응답의 수십 개 중).
const KEY_STATS = [
  "힘",
  "지능",
  "체력",
  "정신력",
  "물리 공격",
  "마법 공격",
  "독립 공격",
  "화속성 강화",
  "수속성 강화",
  "명속성 강화",
  "암속성 강화",
  "공격력 증가",
  "버프력",
  "최종 데미지 증가",
  "HP",
  "MP",
];

export function StatSection({ stats }: { stats: DfStat[] }) {
  const byName = new Map(stats.map((s) => [s.name, s.value]));
  const rows = KEY_STATS.filter((n) => byName.has(n));
  if (rows.length === 0) return null;
  return (
    <Section title="능력치">
      <StatGrid
        rows={rows.map((name) => ({ name, value: byName.get(name)! }))}
      />
    </Section>
  );
}
