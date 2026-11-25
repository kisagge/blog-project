import { itemImageUrl } from "@/lib/neople";
import { rarityColor } from "@/app/df/rarity";
import { fmt } from "./format";

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

// 아이템 이미지. 바로 옆에 항상 이름이 있어 장식용(alt="") — 이름을 두 번 읽지 않게.
export function ItemThumb({ itemId }: { itemId: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={itemImageUrl(itemId)}
      alt=""
      className="h-10 w-10 shrink-0 rounded bg-black/[.03] object-contain dark:bg-white/[.04]"
    />
  );
}

// 아이템 한 줄: 이미지 + 부위(작은 글씨) + 등급 색 이름 + 추가 줄(children).
export function ItemRow({
  itemId,
  slotName,
  itemName,
  itemRarity,
  nameClassName = "",
  children,
}: {
  itemId: string;
  slotName: string;
  itemName: string;
  itemRarity?: string;
  nameClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <ItemThumb itemId={itemId} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-xs text-zinc-500">{slotName}</span>
        <span
          className={[
            "truncate text-sm",
            nameClassName,
            rarityColor(itemRarity),
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {itemName}
        </span>
        {children}
      </div>
    </>
  );
}

// 이름-값 격자(능력치·안개 융화).
export function StatGrid({
  rows,
}: {
  rows: { name: string; value: number | string }[];
}) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
      {rows.map((r) => (
        <div
          key={r.name}
          className="flex items-baseline justify-between gap-2 border-b border-black/[.05] py-1 text-sm dark:border-white/[.08]"
        >
          <dt className="text-zinc-500">{r.name}</dt>
          <dd className="font-medium tabular-nums">{fmt(r.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

// 세트 효과 등 짧은 능력치 나열.
export function StatList({
  stats,
}: {
  stats: { name?: string; key?: string; value: number | string }[];
}) {
  return (
    <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-zinc-500">
      {stats.map((s, i) => (
        <li key={i}>
          {s.name ?? s.key}{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {fmt(s.value)}
          </span>
        </li>
      ))}
    </ul>
  );
}
