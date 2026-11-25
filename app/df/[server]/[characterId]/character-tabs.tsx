import type { TabItem } from "./tabs";
import type { CharacterDetail } from "./load";
import { StatSection } from "./sections/stats";
import {
  EquipSetSection,
  EquipmentSection,
  MistSection,
  OathSection,
} from "./sections/gear";
import { BuffSection, SkillSection } from "./sections/skills";
import { AvatarCreatureSection } from "./sections/avatar";
import { TimelineSection } from "./sections/timeline";

// 상세 데이터 → 탭 목록. 데이터가 있는 그룹만 탭으로 노출(세로 길이 절감).
export function characterTabs({
  status,
  equipment,
  avatar,
  creature,
  timeline,
  skill,
  oath,
  mist,
  buff,
}: CharacterDetail & {
  status: NonNullable<CharacterDetail["status"]>;
}): TabItem[] {
  const hasGear =
    equipment.items.length > 0 || equipment.sets.length > 0 || !!oath || !!mist;
  const hasSkill =
    (skill?.active?.length ?? 0) > 0 ||
    (skill?.passive?.length ?? 0) > 0 ||
    !!buff?.skillInfo ||
    (buff?.equipment?.length ?? 0) > 0;
  return [
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
      content: <AvatarCreatureSection avatar={avatar} creature={creature} />,
    },
    timeline.length > 0 && {
      id: "timeline",
      label: "활동",
      content: <TimelineSection rows={timeline} />,
    },
  ].filter(Boolean) as TabItem[];
}
