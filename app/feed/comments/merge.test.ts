import { describe, expect, test } from "vitest";
import type { CommentNode } from "@/lib/comments";
import {
  applyCreated,
  applyDeleted,
  applyEdited,
  applyLikeCount,
  applyReaction,
  appendLoaded,
} from "./merge";

function node(id: string, replies: CommentNode[] = []): CommentNode {
  return {
    id,
    nickname: "n",
    userId: "u",
    authorRole: "member",
    content: `c-${id}`,
    deleted: false,
    hidden: false,
    edited: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    likeCount: 0,
    liked: false,
    reactions: [],
    replies,
  };
}

describe("applyCreated", () => {
  test("상위 댓글은 맨 앞에 추가하고 total+1", () => {
    const r = applyCreated([node("a")], 1, null, node("b"));
    expect(r.items.map((c) => c.id)).toEqual(["b", "a"]);
    expect(r.total).toBe(2);
  });

  test("대댓글은 부모 아래에 추가, total 불변", () => {
    const r = applyCreated([node("a")], 1, "a", node("a1"));
    expect(r.items[0].replies.map((c) => c.id)).toEqual(["a1"]);
    expect(r.total).toBe(1);
  });

  test("이미 있는 상위 id면 변경 없음(dedup)", () => {
    const items = [node("a")];
    const r = applyCreated(items, 1, null, node("a"));
    expect(r.items).toBe(items); // 동일 참조
    expect(r.total).toBe(1);
  });

  test("이미 있는 대댓글 id면 변경 없음(dedup)", () => {
    const items = [node("a", [node("a1")])];
    const r = applyCreated(items, 1, "a", node("a1"));
    expect(r.items).toBe(items);
    expect(r.total).toBe(1);
  });

  test("부모가 현재 페이지에 없으면 대댓글은 무시", () => {
    const items = [node("a")];
    const r = applyCreated(items, 1, "ghost", node("x"));
    expect(r.items).toBe(items);
    expect(r.total).toBe(1);
  });
});

describe("applyDeleted", () => {
  test("상위+대댓글 있음 → 가림(내용 비움), total 불변", () => {
    const r = applyDeleted([node("a", [node("a1")])], 1, "a");
    expect(r.items[0].deleted).toBe(true);
    expect(r.items[0].content).toBe("");
    expect(r.items[0].replies).toHaveLength(1); // 답글 보존
    expect(r.total).toBe(1);
  });

  test("상위+대댓글 없음 → 제거, total-1", () => {
    const r = applyDeleted([node("a"), node("b")], 2, "a");
    expect(r.items.map((c) => c.id)).toEqual(["b"]);
    expect(r.total).toBe(1);
  });

  test("대댓글 → 부모에서 제거, total 불변", () => {
    const r = applyDeleted([node("a", [node("a1"), node("a2")])], 1, "a1");
    expect(r.items[0].replies.map((c) => c.id)).toEqual(["a2"]);
    expect(r.total).toBe(1);
  });

  test("없는 id → 변경 없음", () => {
    const items = [node("a")];
    const r = applyDeleted(items, 1, "ghost");
    expect(r.items).toBe(items);
    expect(r.total).toBe(1);
  });

  test("하드 삭제 두 번 적용해도 total은 한 번만 감소(idempotent)", () => {
    const r1 = applyDeleted([node("a"), node("b")], 2, "a");
    const r2 = applyDeleted(r1.items, r1.total, "a"); // SSE 에코 재적용
    expect(r2.items.map((c) => c.id)).toEqual(["b"]);
    expect(r2.total).toBe(1); // -1 한 번만
  });
});

describe("applyEdited", () => {
  test("상위 댓글 content 갱신 + edited", () => {
    const r = applyEdited([node("a"), node("b")], 2, "a", "수정됨");
    expect(r.items[0].content).toBe("수정됨");
    expect(r.items[0].edited).toBe(true);
    expect(r.items[1].content).toBe("c-b"); // 다른 댓글 불변
    expect(r.total).toBe(2);
  });

  test("대댓글 content 갱신 + edited, total 불변", () => {
    const r = applyEdited([node("a", [node("a1")])], 1, "a1", "답수정");
    expect(r.items[0].replies[0].content).toBe("답수정");
    expect(r.items[0].replies[0].edited).toBe(true);
    expect(r.total).toBe(1);
  });

  test("없는 id → 변경 없음", () => {
    const items = [node("a")];
    const r = applyEdited(items, 1, "ghost", "x");
    expect(r.items).toBe(items);
  });
});

describe("applyLikeCount", () => {
  test("상위/대댓글 likeCount 갱신(liked·content 불변), total 불변", () => {
    const items = [node("a", [node("a1")])];
    const r = applyLikeCount(items, 1, "a", 5);
    expect(r.items[0].likeCount).toBe(5);
    expect(r.items[0].content).toBe("c-a"); // 본문 불변
    const r2 = applyLikeCount(r.items, 1, "a1", 3);
    expect(r2.items[0].replies[0].likeCount).toBe(3);
    expect(r2.total).toBe(1);
  });
  test("없는 id → 변경 없음", () => {
    const items = [node("a")];
    expect(applyLikeCount(items, 1, "ghost", 9).items).toBe(items);
  });
});

describe("applyReaction", () => {
  test("신규 이모지 추가(reacted:false), 세트 순서 유지", () => {
    const items = [node("a")];
    const r = applyReaction(items, 1, "a", "😂", 2);
    expect(r.items[0].reactions).toEqual([
      { emoji: "😂", count: 2, reacted: false },
    ]);
    // 👍는 😂보다 세트에서 앞 → 추가 시 앞에 배치
    const r2 = applyReaction(r.items, 1, "a", "👍", 1);
    expect(r2.items[0].reactions.map((x) => x.emoji)).toEqual(["👍", "😂"]);
  });

  test("count 0이면 해당 이모지 제거, 내 reacted는 보존", () => {
    const items = [
      node("a"),
      // 대댓글에 내가 누른 👍
    ];
    items[0].reactions = [{ emoji: "👍", count: 3, reacted: true }];
    const r = applyReaction(items, 1, "a", "👍", 0);
    expect(r.items[0].reactions).toEqual([]);
    // 카운트만 바뀌면 reacted 보존
    items[0].reactions = [{ emoji: "👍", count: 3, reacted: true }];
    const r2 = applyReaction(items, 1, "a", "👍", 5);
    expect(r2.items[0].reactions).toEqual([
      { emoji: "👍", count: 5, reacted: true },
    ]);
  });

  test("대댓글 reactions 갱신, total 불변, 없는 id 무변경", () => {
    const items = [node("a", [node("a1")])];
    const r = applyReaction(items, 1, "a1", "🎉", 4);
    expect(r.items[0].replies[0].reactions).toEqual([
      { emoji: "🎉", count: 4, reacted: false },
    ]);
    expect(r.total).toBe(1);
    expect(applyReaction(items, 1, "ghost", "👍", 1).items).toBe(items);
  });
});

describe("appendLoaded", () => {
  test("기존에 없는 항목만 이어붙임(실시간 prepend된 댓글 중복 제거)", () => {
    const items = [node("live"), node("a")]; // live는 SSE로 먼저 들어옴
    const more = [node("a"), node("live"), node("c")]; // 다음 페이지에 a·live 재등장
    const merged = appendLoaded(items, more);
    expect(merged.map((c) => c.id)).toEqual(["live", "a", "c"]); // 중복 없음
  });
});
