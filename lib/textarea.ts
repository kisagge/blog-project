// 제어 컴포넌트 textarea의 선택 영역(start..end)을 insert로 치환한 새 문자열 반환(순수).
// 빈 선택(start==end)이면 커서 위치에 삽입. 경계는 0..value.length로 클램프.
export function spliceText(
  value: string,
  start: number,
  end: number,
  insert: string,
): string {
  const s = Math.max(0, Math.min(start, value.length));
  const e = Math.max(s, Math.min(end, value.length));
  return value.slice(0, s) + insert + value.slice(e);
}
