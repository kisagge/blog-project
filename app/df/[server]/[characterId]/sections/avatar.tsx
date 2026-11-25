import type { DfAvatarItem, DfCreature } from "@/lib/neople";
import { rarityColor } from "@/app/df/rarity";
import { ItemRow, ItemThumb, Section } from "./common";

// 아바타 탭: 크리쳐(+아티팩트)·아바타(+옵션·엠블렘).
export function AvatarCreatureSection({
  avatar,
  creature,
}: {
  avatar: DfAvatarItem[];
  creature: DfCreature | null;
}) {
  if (avatar.length === 0 && !creature) return null;
  return (
    <Section title="아바타 · 크리쳐">
      {creature && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-black/[.08] p-3 dark:border-white/[.145]">
          <ItemThumb itemId={creature.itemId} />
          <div className="flex min-w-0 flex-col">
            <span className="text-xs text-zinc-500">크리쳐</span>
            <span
              className={`truncate text-sm font-medium ${rarityColor(creature.itemRarity)}`}
            >
              {creature.itemName}
            </span>
            {creature.artifact && creature.artifact.length > 0 && (
              <span className="truncate text-xs text-zinc-500">
                아티팩트 {creature.artifact.map((a) => a.itemName).join(", ")}
              </span>
            )}
          </div>
        </div>
      )}
      {avatar.length > 0 && (
        <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {avatar.map((a) => (
            <li key={a.slotId} className="flex items-center gap-3 py-1">
              <ItemRow
                itemId={a.itemId}
                slotName={a.slotName}
                itemName={a.itemName}
                itemRarity={a.itemRarity}
              >
                {a.optionAbility && (
                  <span className="truncate text-xs text-zinc-500">
                    {a.optionAbility}
                  </span>
                )}
                {a.emblems && a.emblems.length > 0 && (
                  <span className="truncate text-xs text-zinc-500">
                    엠블렘 {a.emblems.map((e) => e.itemName).join(", ")}
                  </span>
                )}
              </ItemRow>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
