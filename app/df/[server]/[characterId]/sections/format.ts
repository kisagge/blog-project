import type { DfStat } from "@/lib/neople";

// 던파 상세 표시용 순수 포맷터.

export function fmt(v: number | string) {
  return typeof v === "number" ? v.toLocaleString() : v;
}

// 마법부여 능력치 → '이름 +값' 나열(없으면 null).
export function enchantText(
  enchant?: { status?: DfStat[] } | null,
): string | null {
  const st = enchant?.status;
  if (!st || st.length === 0) return null;
  return st.map((s) => `${s.name} +${s.value}`).join(", ");
}

// 버프 스위칭 스킬 설명: {valueN} 자리표시를 값으로, 줄바꿈은 가운뎃점으로.
export function buffDesc(option?: {
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

// Neople 타임라인 시각(KST "YYYY-MM-DD HH:MM") → <time datetime>용 오프셋 포함 값. 형식이 다르면 null.
export function neopleDateTime(date: string): string | null {
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(date)
    ? `${date.replace(" ", "T")}+09:00`
    : null;
}
