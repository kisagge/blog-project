import { describe, expect, test } from "vitest";
import { serverName } from "@/lib/df-servers";

describe("serverName", () => {
  test("알려진 서버 ID는 한글 이름으로", () => {
    expect(serverName("cain")).toBe("카인");
    expect(serverName("bakal")).toBe("바칼");
  });
  test("모르는 ID는 그대로 반환", () => {
    expect(serverName("unknown")).toBe("unknown");
  });
});
