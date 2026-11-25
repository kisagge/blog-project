import type { DfBuffSwitching, DfSkillEntry, DfSkillStyle } from "@/lib/neople";
import { ItemRow, Section } from "./common";
import { buffDesc } from "./format";

// 스킬 탭: 액티브·패시브 스킬, 버프 스위칭.

function SkillGroup({
  label,
  skills,
}: {
  label: string;
  skills: DfSkillEntry[];
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-zinc-500">{label}</p>
      <ul className="flex flex-wrap gap-1.5">
        {skills.map((s) => (
          <li
            key={s.skillId}
            className="rounded border border-black/[.08] px-2 py-0.5 text-xs dark:border-white/[.145]"
          >
            {s.name}
            {typeof s.level === "number" && (
              <span className="text-zinc-500"> Lv{s.level}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SkillSection({ skill }: { skill: DfSkillStyle | null }) {
  const active = skill?.active ?? [];
  const passive = skill?.passive ?? [];
  if (active.length === 0 && passive.length === 0) return null;
  return (
    <Section title="스킬">
      <div className="flex flex-col gap-3">
        {active.length > 0 && <SkillGroup label="액티브" skills={active} />}
        {passive.length > 0 && <SkillGroup label="패시브" skills={passive} />}
      </div>
    </Section>
  );
}

export function BuffSection({ buff }: { buff: DfBuffSwitching | null }) {
  const equipment = buff?.equipment ?? [];
  if (!buff?.skillInfo && equipment.length === 0) return null;
  const desc = buffDesc(buff?.skillInfo?.option);
  return (
    <Section title="버프 스위칭">
      {buff?.skillInfo && (
        <div className="mb-3">
          <p className="text-sm font-medium">
            {buff.skillInfo.name}
            {typeof buff.skillInfo.option?.level === "number" && (
              <span className="text-zinc-500">
                {" "}
                Lv{buff.skillInfo.option.level}
              </span>
            )}
          </p>
          {desc && <p className="mt-0.5 text-xs text-zinc-500">{desc}</p>}
        </div>
      )}
      {equipment.length > 0 && (
        <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.1]">
          {equipment.map((it) => (
            <li key={it.slotId} className="flex items-center gap-3 py-2">
              <ItemRow
                itemId={it.itemId}
                slotName={it.slotName}
                itemName={it.itemName}
                itemRarity={it.itemRarity}
              />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
