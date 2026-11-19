import { describe, expect, test } from "vitest";
import robots from "@/app/robots";

describe("robots.txt", () => {
  const rules = robots().rules as { disallow: string[] };

  test("색인할 내용이 없는 경로는 크롤링 제외", () => {
    for (const p of ["/me", "/maintenance", "/offline.html", "/api/"])
      expect(rules.disallow).toContain(p);
  });

  test("회원 게이트 페이지는 robots.txt로 막지 않음(막으면 noindex를 못 읽어 URL만 색인될 수 있음)", () => {
    for (const p of ["/u/", "/following", "/community", "/feed"])
      expect(rules.disallow).not.toContain(p);
  });
});
