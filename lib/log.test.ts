import { describe, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { swallow } from "@/lib/log";

describe("swallow", () => {
  test("Error는 태그 + 메시지로 console.error 1회", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    swallow("notify:x")(new Error("boom"));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]).toEqual(["[notify:x]", "boom"]);
    spy.mockRestore();
  });

  test("Error 아닌 값도 그대로 기록", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    swallow("t")("문자열 오류");
    expect(spy.mock.calls[0]).toEqual(["[t]", "문자열 오류"]);
    spy.mockRestore();
  });
});
