import type { CommentNode } from "@/lib/comments";

type Tree = { items: CommentNode[]; total: number };

// 트리에 해당 id의 댓글(상위 또는 대댓글)이 이미 있는지.
function exists(items: CommentNode[], id: string): boolean {
  return items.some((t) => t.id === id || t.replies.some((r) => r.id === id));
}

// 새 댓글 병합. 이미 있으면 변경 없음(낙관적 삽입 + SSE 에코 중복 흡수).
// 상위면 맨 앞에 추가(+total), 대댓글이면 부모 아래에 추가(total 불변).
// 부모가 현재 페이지에 없으면 대댓글은 무시(no-op).
export function applyCreated(
  items: CommentNode[],
  total: number,
  parentId: string | null,
  node: CommentNode,
): Tree {
  if (exists(items, node.id)) return { items, total };
  if (parentId === null) {
    return { items: [node, ...items], total: total + 1 };
  }
  let inserted = false;
  const next = items.map((t) => {
    if (t.id !== parentId) return t;
    inserted = true;
    return { ...t, replies: [...t.replies, node] };
  });
  return inserted ? { items: next, total } : { items, total };
}

// loadMore로 받은 다음 페이지를 이어붙이되, 실시간(SSE)으로 이미 들어온 상위 댓글과의
// 중복 제거. 정렬(인기순) 차이로 prepend된 신규 댓글이 다음 페이지에 다시 올 수 있어 필요.
export function appendLoaded(
  items: CommentNode[],
  more: CommentNode[],
): CommentNode[] {
  const seen = new Set(items.map((c) => c.id));
  return [...items, ...more.filter((c) => !seen.has(c.id))];
}

// 삭제 병합. 상위+대댓글 있음 → 가림(내용 비움), 상위+대댓글 없음 → 제거(−total),
// 대댓글 → 부모에서 제거(total 불변). 없으면 변경 없음.
export function applyDeleted(
  items: CommentNode[],
  total: number,
  id: string,
): Tree {
  const top = items.find((t) => t.id === id);
  if (top) {
    if (top.replies.length > 0) {
      const next = items.map((t) =>
        t.id === id ? { ...t, deleted: true, content: "" } : t,
      );
      return { items: next, total };
    }
    return { items: items.filter((t) => t.id !== id), total: total - 1 };
  }
  // 대댓글 삭제
  if (items.some((t) => t.replies.some((r) => r.id === id))) {
    const next = items.map((t) =>
      t.replies.some((r) => r.id === id)
        ? { ...t, replies: t.replies.filter((r) => r.id !== id) }
        : t,
    );
    return { items: next, total };
  }
  return { items, total };
}
