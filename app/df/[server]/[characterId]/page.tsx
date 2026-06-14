import Link from "next/link";
import {
  getCharacterStatus,
  getEquipment,
  getAvatar,
  getCreature,
  getTimeline,
  getSkillStyle,
  getOath,
  getMistAssimilation,
  getBuffEquipment,
  characterImageUrl,
  itemImageUrl,
  type DfStatusResponse,
  type DfStat,
  type DfEquipItem,
  type DfActiveSet,
  type DfAvatarItem,
  type DfCreature,
  type DfTimelineRow,
  type DfSkillStyle,
  type DfSkillEntry,
  type DfOath,
  type DfMistAssimilation,
  type DfBuffSwitching,
} from "@/lib/neople";
import { rarityColor } from "@/app/df/rarity";
import { getFeaturedByCharacter } from "@/lib/df-characters";
import ViewTracker from "@/app/view-tracker";
import Tabs, { type TabItem } from "./tabs";

export const metadata = { title: "캐릭터 상세 · 던파" };

export default async function DfDetailPage({
  params,
}: {
  params: Promise<{ server: string; characterId: string }>;
}) {
  const { server, characterId } = await params;
  const [
    status,
    equipment,
    avatar,
    creature,
    timeline,
    skill,
    oath,
    mist,
    buff,
  ] = await Promise.all([
    getCharacterStatus(server, characterId).catch(() => null),
    getEquipment(server, characterId).catch(() => ({ items: [], sets: [] })),
    getAvatar(server, characterId).catch(() => []),
    getCreature(server, characterId).catch(() => null),
    getTimeline(server, characterId, 15).catch(() => []),
    getSkillStyle(server, characterId).catch(() => null),
    getOath(server, characterId).catch(() => null),
    getMistAssimilation(server, characterId).catch(() => null),
    getBuffEquipment(server, characterId).catch(() => null),
  ]);
  // 등록된 쇼케이스 캐릭터면 조회수 트래킹/표시(미등록이면 null).
  const featured = await getFeaturedByCharacter(server, characterId).catch(
    () => null,
  );

  // 데이터가 있는 그룹만 탭으로 노출(세로 길이 절감).
  const hasGear =
    equipment.items.length > 0 || equipment.sets.length > 0 || !!oath || !!mist;
  const hasSkill =
    (skill?.active?.length ?? 0) > 0 ||
    (skill?.passive?.length ?? 0) > 0 ||
    !!buff?.skillInfo ||
    (buff?.equipment?.length ?? 0) > 0;
  const tabs: TabItem[] = status
    ? ([
        status.status?.length > 0 && {
          id: "stat",
          label: "능력치",
          content: <StatSection stats={status.status} />,
        },
        hasGear && {
          id: "gear",
          label: "장비",
          content: (
            <>
              <EquipmentSection items={equipment.items} />
              <EquipSetSection sets={equipment.sets} />
              <OathSection oath={oath} />
              <MistSection mist={mist} />
            </>
          ),
        },
        hasSkill && {
          id: "skill",
          label: "스킬",
          content: (
            <>
              <SkillSection skill={skill} />
              <BuffSection buff={buff} />
            </>
          ),
        },
        (avatar.length > 0 || !!creature) && {
          id: "avatar",
          label: "아바타",
          content: (
            <AvatarCreatureSection avatar={avatar} creature={creature} />
          ),
        },
        timeline.length > 0 && {
          id: "timeline",
          label: "활동",
          content: <TimelineSection rows={timeline} />,
        },
      ].filter(Boolean) as TabItem[])
    : [];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <Link
        href="/df"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        ← 목록
      </Link>

      {featured && <ViewTracker type="df" id={featured.id} />}

      {!status ? (
        <p className="mt-8 text-sm text-zinc-500">
          캐릭터 정보를 불러오지 못했습니다.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-8">
          <Header
            status={status}
            server={server}
            characterId={characterId}
            viewCount={featured?.viewCount}
          />
          <Tabs tabs={tabs} />
        </div>
      )}
    </main>
  );
}

function Section({
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

function Header({
  status,
  server,
  characterId,
  viewCount,
}: {
  status: DfStatusResponse;
  server: string;
  characterId: string;
  viewCount?: number;
}) {
  return (
    <div className="flex items-center gap-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={characterImageUrl(server, characterId, 2)}
        alt={status.characterName}
        className="h-28 w-28 shrink-0 rounded bg-black/[.03] object-contain dark:bg-white/[.04]"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="truncate text-2xl font-semibold tracking-tight">
          {status.characterName}
        </h1>
        <p className="text-sm text-zinc-500">
          Lv{status.level} · {status.jobGrowName}
        </p>
        <p className="text-sm text-zinc-500">
          {status.adventureName && <>모험단 {status.adventureName}</>}
          {status.guildName && <> · 길드 {status.guildName}</>}
        </p>
        {typeof status.fame === "number" && (
          <p className="text-sm font-medium text-amber-600 dark:text-amber-500">
            명성 {status.fame.toLocaleString()}
          </p>
        )}
        {typeof viewCount === "number" && (
          <p className="text-sm text-zinc-500">
            조회 {viewCount.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}

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

function fmt(v: number | string) {
  return typeof v === "number" ? v.toLocaleString() : v;
}

function enchantText(enchant?: { status?: DfStat[] } | null): string | null {
  const st = enchant?.status;
  if (!st || st.length === 0) return null;
  return st.map((s) => `${s.name} +${s.value}`).join(", ");
}

function StatSection({ stats }: { stats: DfStat[] }) {
  const byName = new Map(stats.map((s) => [s.name, s.value]));
  const rows = KEY_STATS.filter((n) => byName.has(n));
  if (rows.length === 0) return null;
  return (
    <Section title="능력치">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
        {rows.map((name) => (
          <div
            key={name}
            className="flex items-baseline justify-between gap-2 border-b border-black/[.05] py-1 text-sm dark:border-white/[.08]"
          >
            <dt className="text-zinc-500">{name}</dt>
            <dd className="font-medium tabular-nums">
              {fmt(byName.get(name)!)}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function ItemThumb({ itemId, alt }: { itemId: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={itemImageUrl(itemId)}
      alt={alt}
      className="h-10 w-10 shrink-0 rounded bg-black/[.03] object-contain dark:bg-white/[.04]"
    />
  );
}

function EquipmentSection({ items }: { items: DfEquipItem[] }) {
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
              <ItemThumb itemId={it.itemId} alt={it.itemName} />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs text-zinc-400">
                  {it.slotName}
                </span>
                <span
                  className={`truncate text-sm font-medium ${rarityColor(it.itemRarity)}`}
                >
                  {it.itemName}
                </span>
                {enchant && (
                  <span className="truncate text-xs text-sky-600 dark:text-sky-400">
                    마법부여 {enchant}
                  </span>
                )}
              </div>
              <span className="ml-auto shrink-0 text-right text-xs text-zinc-500">
                {enhance && <div>{enhance}</div>}
                {typeof it.refine === "number" && it.refine > 0 && (
                  <div>재련 {it.refine}</div>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function StatList({
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

function EquipSetSection({ sets }: { sets: DfActiveSet[] }) {
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

function OathSection({ oath }: { oath: DfOath | null }) {
  if (!oath) return null;
  return (
    <Section title="서약">
      <div className="flex items-center gap-3">
        <ItemThumb itemId={oath.info.itemId} alt={oath.info.itemName} />
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
              <span className="w-5 shrink-0 text-xs text-zinc-400">
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
          <span className="text-xs text-zinc-400">활성 세트</span>
          <p
            className={`text-sm font-medium ${rarityColor(oath.setInfo.setRarityName?.split(" ")[0])}`}
          >
            {oath.setInfo.setOptionName ?? oath.setInfo.setName}
            {oath.setInfo.setRarityName && (
              <span className="ml-1 text-xs text-zinc-400">
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

function MistSection({ mist }: { mist: DfMistAssimilation | null }) {
  if (!mist) return null;
  return (
    <Section title="안개 융화">
      <p className="mb-2 text-sm text-zinc-500">
        레벨 {mist.level}
        {mist.expRate && ` · ${mist.expRate}`}
      </p>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
        {mist.status.map((s) => (
          <div
            key={s.name}
            className="flex items-baseline justify-between gap-2 border-b border-black/[.05] py-1 text-sm dark:border-white/[.08]"
          >
            <dt className="text-zinc-500">{s.name}</dt>
            <dd className="font-medium tabular-nums">{fmt(s.value)}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function SkillGroup({
  label,
  skills,
}: {
  label: string;
  skills: DfSkillEntry[];
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-zinc-400">{label}</p>
      <ul className="flex flex-wrap gap-1.5">
        {skills.map((s) => (
          <li
            key={s.skillId}
            className="rounded border border-black/[.08] px-2 py-0.5 text-xs dark:border-white/[.145]"
          >
            {s.name}
            {typeof s.level === "number" && (
              <span className="text-zinc-400"> Lv{s.level}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SkillSection({ skill }: { skill: DfSkillStyle | null }) {
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

function buffDesc(option?: {
  desc?: string;
  values?: string[];
}): string | null {
  if (!option?.desc) return null;
  let text = option.desc;
  (option.values ?? []).forEach((v, i) => {
    text = text.replaceAll(`{value${i + 1}}`, v);
  });
  return text.replace(/\n/g, " · ");
}

function BuffSection({ buff }: { buff: DfBuffSwitching | null }) {
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
              <span className="text-zinc-400">
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
              <ItemThumb itemId={it.itemId} alt={it.itemName} />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs text-zinc-400">
                  {it.slotName}
                </span>
                <span
                  className={`truncate text-sm ${rarityColor(it.itemRarity)}`}
                >
                  {it.itemName}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function AvatarCreatureSection({
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
          <ItemThumb itemId={creature.itemId} alt={creature.itemName} />
          <div className="flex min-w-0 flex-col">
            <span className="text-xs text-zinc-400">크리쳐</span>
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
              <ItemThumb itemId={a.itemId} alt={a.itemName} />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs text-zinc-400">
                  {a.slotName}
                </span>
                <span
                  className={`truncate text-sm ${rarityColor(a.itemRarity)}`}
                >
                  {a.itemName}
                </span>
                {a.optionAbility && (
                  <span className="truncate text-xs text-zinc-500">
                    {a.optionAbility}
                  </span>
                )}
                {a.emblems && a.emblems.length > 0 && (
                  <span className="truncate text-xs text-zinc-400">
                    엠블렘 {a.emblems.map((e) => e.itemName).join(", ")}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function TimelineSection({ rows }: { rows: DfTimelineRow[] }) {
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
            <span className="shrink-0 text-xs text-zinc-400">{r.date}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
