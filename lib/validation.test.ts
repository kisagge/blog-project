import {
  FeedFormSchema,
  feedFormToObject,
  SignupSchema,
  ResetPasswordSchema,
  ProfileSchema,
  SeriesSchema,
} from "@/lib/validation";

describe("FeedFormSchema", () => {
  const valid = {
    title: "제목",
    slug: "hello-world",
    summary: "",
    content: "본문",
    visibility: "public",
  };

  test("유효한 입력을 통과시킨다", () => {
    expect(FeedFormSchema.safeParse(valid).success).toBe(true);
  });

  test.each([
    ["대문자", "Hello"],
    ["공백", "hello world"],
    ["언더스코어", "hello_world"],
    ["빈값", ""],
  ])("잘못된 slug(%s)를 거부한다", (_label, slug) => {
    const r = FeedFormSchema.safeParse({ ...valid, slug });
    expect(r.success).toBe(false);
  });

  test("title이 비면 거부한다", () => {
    expect(FeedFormSchema.safeParse({ ...valid, title: "  " }).success).toBe(
      false,
    );
  });

  test("content가 비면 거부한다", () => {
    expect(FeedFormSchema.safeParse({ ...valid, content: "" }).success).toBe(
      false,
    );
  });
});

describe("비밀번호 규칙(가입·재설정 공용)", () => {
  const base = { email: "a@x.com", nickname: "닉" };
  test("소문자·대문자·숫자·특수문자 모두 포함하면 통과", () => {
    expect(
      SignupSchema.safeParse({ ...base, password: "Abcd123!" }).success,
    ).toBe(true);
  });

  test.each([
    ["8자 미만", "Ab1!"],
    ["소문자 없음", "ABCD123!"],
    ["대문자 없음", "abcd123!"],
    ["숫자 없음", "Abcdefg!"],
    ["특수문자 없음", "Abcd1234"],
  ])("약한 비밀번호(%s) 거부", (_label, password) => {
    expect(SignupSchema.safeParse({ ...base, password }).success).toBe(false);
  });

  test("재설정: 비밀번호 확인 불일치 거부", () => {
    const r = ResetPasswordSchema.safeParse({
      password: "Abcd123!",
      confirm: "Abcd123?",
    });
    expect(r.success).toBe(false);
  });

  test("재설정: 일치하면 통과", () => {
    expect(
      ResetPasswordSchema.safeParse({
        password: "Abcd123!",
        confirm: "Abcd123!",
      }).success,
    ).toBe(true);
  });
});

describe("feedFormToObject", () => {
  test("visibility select 값을 그대로 반영", () => {
    const fd = new FormData();
    fd.set("visibility", "members");
    expect(feedFormToObject(fd).visibility).toBe("members");
  });

  test("visibility 없거나 잘못된 값이면 비공개(private)", () => {
    expect(feedFormToObject(new FormData()).visibility).toBe("private");
    const fd = new FormData();
    fd.set("visibility", "xyz");
    expect(feedFormToObject(fd).visibility).toBe("private");
  });
});

describe("SeriesSchema", () => {
  test("유효한 제목·slug 통과", () => {
    expect(
      SeriesSchema.safeParse({ title: "연재", slug: "my-series" }).success,
    ).toBe(true);
  });
  test("slug 대문자·공백·빈 제목 거부", () => {
    expect(
      SeriesSchema.safeParse({ title: "x", slug: "My Series" }).success,
    ).toBe(false);
    expect(SeriesSchema.safeParse({ title: "", slug: "ok" }).success).toBe(
      false,
    );
  });
});

describe("ProfileSchema", () => {
  const base = { nickname: "철수", bio: "", avatarUrl: "" };

  test("빈 bio·avatar 허용", () => {
    expect(ProfileSchema.safeParse(base).success).toBe(true);
  });

  test("bio 160자 초과 거부", () => {
    const r = ProfileSchema.safeParse({ ...base, bio: "가".repeat(161) });
    expect(r.success).toBe(false);
  });

  test("avatarUrl: 우리 업로드 경로(쿼리 포함)만 허용", () => {
    expect(
      ProfileSchema.safeParse({
        ...base,
        avatarUrl: "/uploads/ab12-cd.png?w=80&h=80",
      }).success,
    ).toBe(true);
    expect(
      ProfileSchema.safeParse({ ...base, avatarUrl: "/uploads/x.gif" }).success,
    ).toBe(false); // 미지원 확장자
  });

  test("avatarUrl: 외부 URL·javascript·비-uploads 경로 거부", () => {
    for (const bad of [
      "https://evil.com/a.png",
      "javascript:alert(1)",
      "/etc/passwd",
      "/uploads/../secret.png",
    ]) {
      expect(ProfileSchema.safeParse({ ...base, avatarUrl: bad }).success).toBe(
        false,
      );
    }
  });
});
