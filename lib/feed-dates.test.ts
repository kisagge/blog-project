import { describe, expect, test } from "vitest";
import {
  bodyChanged,
  feedLastModified,
  visibleEditedAt,
} from "@/lib/feed-dates";

describe("bodyChanged", () => {
  const prev = { title: "제목", content: "본문", summary: "요약" };

  test("제목·본문·요약이 같으면 false", () => {
    expect(bodyChanged(prev, { ...prev })).toBe(false);
  });

  test.each([
    ["title", { title: "새 제목" }],
    ["content", { content: "새 본문" }],
    ["summary", { summary: "새 요약" }],
  ])("%s가 바뀌면 true", (_k, patch) => {
    expect(bodyChanged(prev, { ...prev, ...patch })).toBe(true);
  });

  test("줄바꿈 방식(CRLF/LF)만 다르면 변경 아님(폼 제출은 CRLF)", () => {
    expect(
      bodyChanged(
        { title: "t", content: "a\nb", summary: "x\ny" },
        { title: "t", content: "a\r\nb", summary: "x\r\ny" },
      ),
    ).toBe(false);
  });

  test("요약은 next에 없으면(회원 글) 비교 안 함, null·빈문자열은 같은 값", () => {
    expect(bodyChanged(prev, { title: "제목", content: "본문" })).toBe(false);
    expect(
      bodyChanged(
        { title: "a", content: "b", summary: null },
        { title: "a", content: "b", summary: "" },
      ),
    ).toBe(false);
  });
});

describe("visibleEditedAt", () => {
  const shown = new Date("2026-11-10T01:00:00Z"); // KST 11/10 10:00

  test("수정 이력 없으면 null", () => {
    expect(visibleEditedAt(null, shown)).toBeNull();
  });

  test("같은 KST 날짜 안의 수정은 표시 안 함(오타 정정 등)", () => {
    // KST 11/10 23:30
    expect(visibleEditedAt(new Date("2026-11-10T14:30:00Z"), shown)).toBeNull();
  });

  test("KST 날짜가 넘어간 수정은 표시", () => {
    // UTC로는 같은 날이지만 KST로는 11/11 00:30
    const edited = new Date("2026-11-10T15:30:00Z");
    expect(visibleEditedAt(edited, shown)).toEqual(edited);
  });

  test("표시 날짜보다 이른 수정(예약 글의 게시 전 편집 등)은 표시 안 함", () => {
    expect(visibleEditedAt(new Date("2026-11-01T00:00:00Z"), shown)).toBeNull();
  });
});

describe("feedLastModified", () => {
  const createdAt = new Date("2026-11-01T00:00:00Z");
  const publishedAt = new Date("2026-11-02T00:00:00Z");
  const editedAt = new Date("2026-11-05T00:00:00Z");

  test("editedAt > publishedAt > createdAt 순으로 사용", () => {
    expect(feedLastModified({ createdAt, publishedAt, editedAt })).toBe(
      editedAt,
    );
    expect(feedLastModified({ createdAt, publishedAt, editedAt: null })).toBe(
      publishedAt,
    );
    expect(
      feedLastModified({ createdAt, publishedAt: null, editedAt: null }),
    ).toBe(createdAt);
  });
});
