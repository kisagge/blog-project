import type {
  DfActiveSet,
  DfEquipItem,
  DfMistAssimilation,
  DfOath,
} from "@/lib/neople";
import { rarityColor } from "@/app/df/rarity";
import { ItemRow, ItemThumb, Section, StatGrid, StatList } from "./common";
import { enchantText } from "./format";

// 장비 탭: 장착 장비·활성 세트·서약·안개 융화.

export function EquipmentSection({ items }: { items: DfEquipItem[] }) {
  if (items.length === 0) return null;
  return (
    <Section title="장비">
      <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.1]">
        {items.map((it) => {
          const enhance = it.amplificationName
            ? `증폭 +${it.reinforce ?? 0}`
            : it.reinforce
              ? `+${it.reinforce} 강화`
              : null;
          const enchant = enchantText(it.enchant);
          return (
            <li key={it.slotId} className="flex items-center gap-3 py-2">
              <ItemRow
                itemId={it.itemId}
                slotName={it.slotName}
                itemName={it.itemName}
                itemRarity={it.itemRarity}
                nameClassName="font-medium"
              >
                {enchant && (
                  <span className="truncate text-xs text-sky-600 dark:text-sky-400">
                    마법부여 {enchant}
                  </span>
                )}
              </ItemRow>
              <div className="ml-auto shrink-0 text-right text-xs text-zinc-500">
                {enhance && <div>{enhance}</div>}
                {typeof it.refine === "number" && it.refine > 0 && (
                  <div>재련 {it.refine}</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

export function EquipSetSection({ sets }: { sets: DfActiveSet[] }) {
  if (sets.length === 0) return null;
  return (
    <Section title="장비 활성 세트">
      <ul className="flex flex-col gap-3">
        {sets.map((s, i) => (
          <li
            key={i}
            className="rounded-lg border border-black/[.08] p-3 dark:border-white/[.145]"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={`text-sm font-medium ${rarityColor(s.setItemRarityName)}`}
              >
                {s.setItemName}
              </span>
              {typeof s.active?.setPoint?.current === "number" && (
                <span className="shrink-0 text-xs text-zinc-500">
                  세트 포인트 {s.active.setPoint.current.toLocaleString()}
                </span>
              )}
            </div>
            {s.active?.status && s.active.status.length > 0 && (
              <StatList stats={s.active.status} />
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function OathSection({ oath }: { oath: DfOath | null }) {
  if (!oath) return null;
  return (
    <Section title="서약">
      <div className="flex items-center gap-3">
        <ItemThumb itemId={oath.info.itemId} />
        <div className="flex min-w-0 flex-col">
          <span
            className={`truncate text-sm font-medium ${rarityColor(oath.info.itemRarity)}`}
          >
            {oath.info.itemName}
          </span>
          {typeof oath.info.setPoint === "number" && (
            <span className="text-xs text-zinc-500">
              세트 포인트 {oath.info.setPoint}
            </span>
          )}
        </div>
      </div>
      {oath.crystal && oath.crystal.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {oath.crystal.map((c, i) => (
            <li
              key={`${c.slotNo}-${i}`}
              className="flex items-center gap-2 text-sm"
            >
              <span className="w-5 shrink-0 text-xs text-zinc-500">
                {c.slotNo + 1}
              </span>
              <span className={`truncate ${rarityColor(c.itemRarity)}`}>
                {c.itemName}
              </span>
            </li>
          ))}
        </ul>
      )}
      {oath.setInfo && (
        <div className="mt-3 rounded-lg border border-black/[.08] p-3 dark:border-white/[.145]">
          <span className="text-xs text-zinc-500">활성 세트</span>
          <p
            className={`text-sm font-medium ${rarityColor(oath.setInfo.setRarityName?.split(" ")[0])}`}
          >
            {oath.setInfo.setOptionName ?? oath.setInfo.setName}
            {oath.setInfo.setRarityName && (
              <span className="ml-1 text-xs text-zinc-500">
                {oath.setInfo.setRarityName}
              </span>
            )}
          </p>
          {oath.setInfo.active?.status &&
            oath.setInfo.active.status.length > 0 && (
              <StatList stats={oath.setInfo.active.status} />
            )}
        </div>
      )}
    </Section>
  );
}

export function MistSection({ mist }: { mist: DfMistAssimilation | null }) {
  if (!mist) return null;
  return (
    <Section title="안개 융화">
      <p className="mb-2 text-sm text-zinc-500">
        레벨 {mist.level}
        {mist.expRate && ` · ${mist.expRate}`}
      </p>
      <StatGrid rows={mist.status} />
    </Section>
  );
}
