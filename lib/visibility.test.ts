import { describe, expect, test } from "vitest";
import { checkAccess, listableVisibilities } from "@/lib/visibility";

describe("checkAccess", () => {
  test("전체공개는 누구나 ok", () => {
    expect(checkAccess("public", "anon")).toBe("ok");
    expect(checkAccess("public", "member")).toBe("ok");
    expect(checkAccess("public", "admin")).toBe("ok");
  });
  test("회원공개는 비로그인은 members-only, 회원·관리자는 ok", () => {
    expect(checkAccess("members", "anon")).toBe("members-only");
    expect(checkAccess("members", "member")).toBe("ok");
    expect(checkAccess("members", "admin")).toBe("ok");
  });
  test("비공개는 관리자만 ok, 그 외 not-found", () => {
    expect(checkAccess("private", "anon")).toBe("not-found");
    expect(checkAccess("private", "member")).toBe("not-found");
    expect(checkAccess("private", "admin")).toBe("ok");
  });
});

describe("listableVisibilities", () => {
  test("anon은 전체공개만, 회원은 전체+회원, 관리자는 비공개까지", () => {
    expect(listableVisibilities("anon")).toEqual(["public"]);
    expect(listableVisibilities("member")).toEqual(["public", "members"]);
    expect(listableVisibilities("admin")).toEqual([
      "public",
      "members",
      "private",
    ]);
  });
});
