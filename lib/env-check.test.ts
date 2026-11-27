import { describe, expect, test } from "vitest";
import { productionSecretProblems } from "@/lib/env-check";

const good = {
  SESSION_SECRET: "x".repeat(44),
  ADMIN_PASSWORD: "a-real-password",
};

describe("productionSecretProblems", () => {
  test("정상 값이면 문제 없음", () => {
    expect(productionSecretProblems(good)).toEqual([]);
  });

  test("세션 키: 없음·짧음·예시값(저장소에 공개된 값 → 관리자 세션 위조 가능)", () => {
    for (const SESSION_SECRET of [
      undefined,
      "short",
      "generate-with-openssl-rand-base64-32",
    ])
      expect(
        productionSecretProblems({ ...good, SESSION_SECRET }),
      ).toHaveLength(1);
  });

  test("관리자 비밀번호: 없음·예시값", () => {
    for (const ADMIN_PASSWORD of [undefined, "", "change-me"])
      expect(
        productionSecretProblems({ ...good, ADMIN_PASSWORD }),
      ).toHaveLength(1);
  });

  test("문제 설명에 값 자체는 담지 않음(로그 유출 방지)", () => {
    const msgs = productionSecretProblems({
      SESSION_SECRET: "leaky",
      ADMIN_PASSWORD: "change-me",
    });
    expect(msgs.join(" ")).not.toContain("leaky");
  });
});
