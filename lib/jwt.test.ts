// @vitest-environment node
import { describe, test, expect } from "vitest";
import { encrypt, decrypt } from "@/lib/jwt";

describe("jwt encrypt/decrypt", () => {
  test("라운드트립: payload를 복원한다", async () => {
    const token = await encrypt({ admin: true, expiresAt: "2099-01-01T00:00:00.000Z" });
    const payload = await decrypt(token);
    expect(payload?.admin).toBe(true);
    expect(payload?.expiresAt).toBe("2099-01-01T00:00:00.000Z");
  });

  test("토큰이 없으면 undefined", async () => {
    expect(await decrypt(undefined)).toBeUndefined();
  });

  test("변조된 토큰은 undefined", async () => {
    const token = await encrypt({ admin: true, expiresAt: "2099-01-01T00:00:00.000Z" });
    expect(await decrypt(token + "tampered")).toBeUndefined();
  });
});
