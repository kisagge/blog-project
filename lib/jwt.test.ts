// @vitest-environment node
import { describe, test, expect } from "vitest";
import { SignJWT } from "jose";
import { encrypt, decrypt } from "@/lib/jwt";

describe("jwt encrypt/decrypt", () => {
  test("라운드트립: payload를 복원한다", async () => {
    const token = await encrypt({
      role: "admin",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    const payload = await decrypt(token);
    expect(payload?.role).toBe("admin");
    expect(payload?.expiresAt).toBe("2099-01-01T00:00:00.000Z");
  });

  test("member 페이로드의 전 필드를 보존한다", async () => {
    const token = await encrypt({
      role: "member",
      userId: "u1",
      nickname: "닉네임",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    expect(await decrypt(token)).toMatchObject({
      role: "member",
      userId: "u1",
      nickname: "닉네임",
    });
  });

  test("다른 SECRET으로 서명된 토큰은 undefined(위조 거부)", async () => {
    const forged = await new SignJWT({
      role: "admin",
      expiresAt: "2099-01-01T00:00:00.000Z",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(new TextEncoder().encode("a-totally-different-secret"));
    expect(await decrypt(forged)).toBeUndefined();
  });

  test("토큰이 없으면 undefined", async () => {
    expect(await decrypt(undefined)).toBeUndefined();
  });

  test("변조된 토큰은 undefined", async () => {
    const token = await encrypt({
      role: "admin",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    expect(await decrypt(token + "tampered")).toBeUndefined();
  });
});
