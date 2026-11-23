// 글·댓글 이모지 리액션 공용 상수/타입 — 클라이언트·서버 공용(server-only 아님).
// DB 접근 함수는 lib/comment-reactions.ts·lib/feed-reactions.ts(server-only)에 분리.

// 고정 세트. ♥ 좋아요와 공존하므로 ❤️는 제외(시각적 중복 최소화).
export const REACTION_EMOJIS = ["👍", "😂", "😮", "😢", "🎉"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

// 접근성 라벨(aria-label "{라벨} 반응 N개"). ♥ "좋아요"와 구분되게 명명.
export const REACTION_LABELS: Record<ReactionEmoji, string> = {
  "👍": "최고",
  "😂": "웃겨요",
  "😮": "놀랐어요",
  "😢": "슬퍼요",
  "🎉": "축하해요",
};

export function isReactionEmoji(v: string): v is ReactionEmoji {
  return (REACTION_EMOJIS as readonly string[]).includes(v);
}

export type ReactionSummary = {
  emoji: string;
  count: number;
  reacted: boolean;
};

// 이모지별 수·내 반응 → 화면 요약(고정 세트 순서, 0개인 이모지는 뺀다). 글·댓글 리액션 공용.
export function toReactionSummaries(
  counts: Map<string, number>,
  mine: Set<string>,
): ReactionSummary[] {
  const out: ReactionSummary[] = [];
  for (const emoji of REACTION_EMOJIS) {
    const count = counts.get(emoji) ?? 0;
    if (count > 0) out.push({ emoji, count, reacted: mine.has(emoji) });
  }
  return out;
}
