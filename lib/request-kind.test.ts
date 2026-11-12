import { describe, expect, test } from "vitest";
import { rateBucket, requestKind } from "@/lib/request-kind";

const h = (o: Record<string, string>) => new Headers(o);

describe("requestKind", () => {
  test("주소창·링크로 연 문서", () => {
    expect(
      requestKind("GET", "/feed", h({ "sec-fetch-dest": "document" })),
    ).toBe("document");
  });

  test("페이지 경로의 fetch(프리페치·앱 내 이동) → rsc", () => {
    expect(
      requestKind("GET", "/feed/a", h({ "sec-fetch-dest": "empty" })),
    ).toBe("rsc");
  });

  test("서버 액션(POST)·API·Fetch Metadata 없는 요청은 other", () => {
    expect(
      requestKind(
        "POST",
        "/feed",
        h({ "sec-fetch-dest": "empty", "next-action": "x" }),
      ),
    ).toBe("other");
    expect(
      requestKind("GET", "/api/events", h({ "sec-fetch-dest": "empty" })),
    ).toBe("other");
    expect(requestKind("GET", "/feed", h({}))).toBe("other"); // curl 등
  });

  test("rsc만 별도 버킷, 나머지는 기존(default) 버킷", () => {
    expect(rateBucket("rsc")).toBe("rsc");
    expect(rateBucket("document")).toBe("default");
    expect(rateBucket("other")).toBe("default");
  });
});
