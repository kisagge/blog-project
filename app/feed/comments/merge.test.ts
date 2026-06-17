import { describe, expect, test } from "vitest";
import type { CommentNode } from "@/lib/comments";
import { applyCreated, applyDeleted, appendLoaded } from "./merge";

function node(id: string, replies: CommentNode[] = []): CommentNode {
  return {
    id,
    nickname: "n",
    userId: "u",
    authorRole: "member",
    content: `c-${id}`,
    deleted: false,
    hidden: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    likeCount: 0,
    liked: false,
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

describe("appendLoaded", () => {
  test("기존에 없는 항목만 이어붙임(실시간 prepend된 댓글 중복 제거)", () => {
    const items = [node("live"), node("a")]; // live는 SSE로 먼저 들어옴
    const more = [node("a"), node("live"), node("c")]; // 다음 페이지에 a·live 재등장
    const merged = appendLoaded(items, more);
    expect(merged.map((c) => c.id)).toEqual(["live", "a", "c"]); // 중복 없음
  });
});
