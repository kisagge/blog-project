import { FeedFormSchema, feedFormToObject } from "@/lib/validation";

describe("FeedFormSchema", () => {
  const valid = {
    title: "제목",
    slug: "hello-world",
    summary: "",
    content: "본문",
    published: true,
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
    expect(FeedFormSchema.safeParse({ ...valid, title: "  " }).success).toBe(false);
  });

  test("content가 비면 거부한다", () => {
    expect(FeedFormSchema.safeParse({ ...valid, content: "" }).success).toBe(false);
  });
});

describe("feedFormToObject", () => {
  test("체크박스 on을 boolean true로 변환한다", () => {
    const fd = new FormData();
    fd.set("title", "t");
    fd.set("slug", "s");
    fd.set("content", "c");
    fd.set("published", "on");
    expect(feedFormToObject(fd).published).toBe(true);
  });

  test("published 없으면 false", () => {
    const fd = new FormData();
    expect(feedFormToObject(fd).published).toBe(false);
  });
});
