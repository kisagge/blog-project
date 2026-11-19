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

// 업로드한 이미지의 마크다운. 대체 텍스트를 빈 채로 넣되, 삽입 후 캐럿을 [ ] 안(caret 오프셋)에 둬
// 작성자가 바로 이미지 설명을 입력하게 유도한다. 입력하지 않으면 빈 alt(장식 이미지)로 남는다 —
// "이미지 설명" 같은 자리표시 문구를 넣으면 스크린리더에 의미 없는 말이 읽히므로 넣지 않는다.
export function imageMarkdown(url: string): { text: string; caret: number } {
  return { text: `![](${url})\n`, caret: 2 };
}

export const IMAGE_ALT_HINT =
  "이미지를 넣었습니다. 대괄호 [ ] 안에 이미지 설명(대체 텍스트)을 입력하세요.";
