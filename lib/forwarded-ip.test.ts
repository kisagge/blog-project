import { describe, expect, test } from "vitest";
import { clientIpFromXff } from "@/lib/forwarded-ip";

// nginx `$proxy_add_x_forwarded_for`는 클라이언트가 보낸 값 뒤에 실제 원격 주소를 덧붙인다.
describe("clientIpFromXff", () => {
  test("단일 값", () => {
    expect(clientIpFromXff("1.2.3.4")).toBe("1.2.3.4");
  });

  test("클라이언트가 앞에 위조 값을 넣어도 nginx가 덧붙인 마지막 값을 사용", () => {
    expect(clientIpFromXff("6.6.6.6, 1.2.3.4")).toBe("1.2.3.4");
    expect(clientIpFromXff(" spoof , also-spoof , 9.9.9.9 ")).toBe("9.9.9.9");
  });

  test("비었거나 마지막 항목이 비면 undefined(앞 항목으로 폴백하지 않음)", () => {
    expect(clientIpFromXff(null)).toBeUndefined();
    expect(clientIpFromXff(undefined)).toBeUndefined();
    expect(clientIpFromXff("")).toBeUndefined();
    expect(clientIpFromXff("1.2.3.4,")).toBeUndefined();
  });
});
