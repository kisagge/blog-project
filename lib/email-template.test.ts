import { describe, expect, test } from "vitest";
import {
  passwordResetEmail,
  signupApprovedEmail,
  signupRejectedEmail,
} from "@/lib/email-template";
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

describe("가입 결과 메일", () => {
  test("승인: 닉네임·로그인 링크, 텍스트 폴백 포함", () => {
    const m = signupApprovedEmail("새회원");
    expect(m.subject).toContain("승인");
    expect(m.text).toContain("새회원");
    expect(m.text).toContain("/signin");
    expect(m.html).toContain("<!doctype html>");
    expect(m.html).toContain("/signin");
  });

  test("거절: 재신청 안내, 거절 사유는 담지 않음(신청자 비노출 정책)", () => {
    const m = signupRejectedEmail("새회원");
    expect(m.subject).toContain("가입");
    expect(m.text).toContain("다시 신청");
    expect(m.text).toContain("/signup");
  });

  test("닉네임은 HTML 이스케이프(사용자 입력이 메일 마크업을 바꾸지 못하게)", () => {
    const m = signupApprovedEmail('<a href="x">악성</a>');
    expect(m.html).not.toContain('<a href="x">');
    expect(m.html).toContain("&lt;a href=&quot;x&quot;&gt;");
  });
});
