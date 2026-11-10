// 아카이브(/archive)용 KST 연·월 그룹핑. 순수 함수 — 입력은 최신순 정렬된 글 목록이라 가정하고 순서를 유지.

export type ArchiveMonth<T> = { month: number; items: T[] };
export type ArchiveYear<T> = {
  year: number;
  count: number;
  months: ArchiveMonth<T>[];
};

const KST_OFFSET = 9 * 3600 * 1000;

export function groupByYearMonth<T extends { createdAt: Date }>(
  items: T[],
): ArchiveYear<T>[] {
  const years: ArchiveYear<T>[] = [];
  for (const item of items) {
    const kst = new Date(item.createdAt.getTime() + KST_OFFSET);
    const year = kst.getUTCFullYear();
    const month = kst.getUTCMonth() + 1;
    let y = years.find((g) => g.year === year);
    if (!y) {
      y = { year, count: 0, months: [] };
      years.push(y);
    }
    let m = y.months.find((g) => g.month === month);
    if (!m) {
      m = { month, items: [] };
      y.months.push(m);
    }
    m.items.push(item);
    y.count++;
  }
  // 입력이 최신순이면 이미 정렬돼 있지만, 순서가 섞여 들어와도 연·월은 내림차순 보장.
  years.sort((a, b) => b.year - a.year);
  for (const y of years) y.months.sort((a, b) => b.month - a.month);
  return years;
}

// KST 기준 일(日) — 아카이브 목록의 날짜 칸 표시용.
export function kstDayOfMonth(d: Date): number {
  return new Date(d.getTime() + KST_OFFSET).getUTCDate();
}
