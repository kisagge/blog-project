import { describe, expect, test } from "vitest";
import { diffStats, lineDiff } from "@/lib/text-diff";

describe("lineDiff", () => {
  test("바뀐 줄은 del→add, 같은 줄은 same", () => {
    expect(lineDiff("a\nb\nc", "a\nB\nc")).toEqual([
      { type: "same", text: "a" },
      { type: "del", text: "b" },
      { type: "add", text: "B" },
      { type: "same", text: "c" },
    ]);
  });

  test("바뀐 곳에서 먼 동일 줄은 접어서 개수만", () => {
    const before = Array.from({ length: 20 }, (_, i) => `줄${i}`).join("\n");
    const after = before.replace("줄10", "바뀐 줄");
    const rows = lineDiff(before, after, 2);
    expect(rows[0]).toEqual({ type: "skip", count: 8 }); // 줄0~7
    expect(rows.filter((r) => r.type === "same")).toHaveLength(4); // 앞뒤 2줄씩
    expect(rows.at(-1)).toEqual({ type: "skip", count: 7 }); // 줄13~19
    expect(diffStats(rows)).toEqual({ added: 1, removed: 1 });
  });

  test("마지막 줄의 끝 개행 유무만 다른 건 같은 줄", () => {
    expect(lineDiff("a\nb\n", "a\nB")).toEqual([
      { type: "same", text: "a" },
      { type: "del", text: "b" },
      { type: "add", text: "B" },
    ]);
    expect(lineDiff("a\nb", "a\nb\nc")).toEqual([
      { type: "same", text: "a" },
      { type: "same", text: "b" },
      { type: "add", text: "c" },
    ]);
  });

  test("CRLF와 LF가 섞여도 줄바꿈만 다른 줄은 같은 줄", () => {
    expect(lineDiff("a\nb\nc", "a\r\nB\r\nc")).toEqual([
      { type: "same", text: "a" },
      { type: "del", text: "b" },
      { type: "add", text: "B" },
      { type: "same", text: "c" },
    ]);
  });

  test("같으면 전부 접힘, 빈 → 내용은 전부 추가", () => {
    expect(lineDiff("x\ny", "x\ny")).toEqual([{ type: "skip", count: 2 }]);
    expect(lineDiff("", "새\n글")).toEqual([
      { type: "add", text: "새" },
      { type: "add", text: "글" },
    ]);
  });
});
