import type { DfTimelineRow } from "@/lib/neople";
import { rarityColor } from "@/app/df/rarity";
import { Section } from "./common";
import { neopleDateTime } from "./format";

// Neople 시각(KST 문자열)은 그대로 보여 주되, 형식이 맞으면 <time datetime>으로.
function NeopleTime({ date }: { date: string }) {
  const iso = neopleDateTime(date);
  const cls = "shrink-0 text-xs text-zinc-500";
  return iso ? (
    <time dateTime={iso} className={cls}>
      {date}
    </time>
  ) : (
    <span className={cls}>{date}</span>
  );
}

// 활동 탭: 최근 타임라인(획득·강화 등).
export function TimelineSection({ rows }: { rows: DfTimelineRow[] }) {
  if (rows.length === 0) return null;
  return (
    <Section title="최근 활동">
      <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.1]">
        {rows.map((r, i) => (
          <li
            key={`${r.date}-${i}`}
            className="flex items-baseline justify-between gap-3 py-1.5 text-sm"
          >
            <span className="min-w-0">
              <span className="text-zinc-500">{r.name}</span>
              {r.data?.itemName && (
                <span className={`ml-2 ${rarityColor(r.data.itemRarity)}`}>
                  {r.data.itemName}
                </span>
              )}
            </span>
            <NeopleTime date={r.date} />
          </li>
        ))}
      </ul>
    </Section>
  );
}
