import { describe, expect, test } from "vitest";
import { passwordResetEmail } from "@/lib/email-template";
import { SITE_NAME } from "@/lib/share";

describe("passwordResetEmail", () => {
  const m = passwordResetEmail("123456");

  test("subject·text·html 반환", () => {
    expect(m.subject).toContain("비밀번호");
    expect(typeof m.text).toBe("string");
    expect(typeof m.html).toBe("string");
  });

  test("text 폴백에 코드·만료 안내 포함", () => {
    expect(m.text).toContain("123456");
    expect(m.text).toContain("3분");
  });

  test("html은 완전한 문서 + 코드·만료·브랜드 포함", () => {
    expect(m.html).toContain("<!doctype html>");
    expect(m.html).toContain("<table");
    expect(m.html).toContain("123456");
    expect(m.html).toContain("3분");
    expect(m.html).toContain(SITE_NAME);
  });

  test("코드 위치에 정확히 입력값이 들어감", () => {
    expect(passwordResetEmail("000777").html).toContain("000777");
  });
});
