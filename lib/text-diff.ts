import { diffLines } from "diff";
import { normalizeEol } from "@/lib/feed-dates";

// 줄바꿈 정규화 + 끝 개행 통일: 폼 저장본(CRLF)과 다른 경로 저장본(LF)이 섞이거나, 마지막 줄에만
// 개행 유무가 달라도 같은 줄을 변경으로 보지 않게.
const prep = (s: string) => {
  const t = normalizeEol(s);
  return t && !t.endsWith("\n") ? t + "\n" : t;
};

export type DiffRow =
  | { type: "same" | "add" | "del"; text: string }
  | { type: "skip"; count: number }; // 접힌 동일 줄 수

// 두 텍스트의 줄 단위 비교(수정 이력 화면). 바뀐 줄 앞뒤 context줄만 남기고 긴 동일 구간은 접는다.
export function lineDiff(
  before: string,
  after: string,
  context = 3,
): DiffRow[] {
  const rows: Exclude<DiffRow, { type: "skip" }>[] = [];
  // 폼 저장본(CRLF)과 다른 경로 저장본(LF)이 섞여도 줄바꿈만 다른 줄을 변경으로 보지 않게 정규화.
  for (const part of diffLines(prep(before), prep(after))) {
    const type = part.added ? "add" : part.removed ? "del" : "same";
    const lines = part.value.replace(/\n$/, "").split("\n");
    for (const text of lines) rows.push({ type, text });
  }
  // 바뀐 줄로부터 context 이내의 동일 줄만 표시.
  const keep = rows.map((r) => r.type !== "same");
  const near = rows.map((_, i) =>
    keep.slice(Math.max(0, i - context), i + context + 1).some(Boolean),
  );
  const out: DiffRow[] = [];
  let skipped = 0;
  rows.forEach((r, i) => {
    if (r.type === "same" && !near[i]) {
      skipped++;
      return;
    }
    if (skipped) out.push({ type: "skip", count: skipped });
    skipped = 0;
    out.push(r);
  });
  if (skipped) out.push({ type: "skip", count: skipped });
  return out;
}

// 변경 요약(추가·삭제 줄 수).
export function diffStats(rows: DiffRow[]) {
  let added = 0;
  let removed = 0;
  for (const r of rows) {
    if (r.type === "add") added++;
    else if (r.type === "del") removed++;
  }
  return { added, removed };
}
