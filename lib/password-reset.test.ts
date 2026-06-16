import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { setupTestDb } from "@/lib/test-db";

vi.mock("server-only", () => ({}));
// 실제 SMTP 발송 대신 mock으로 코드를 가로채 검증에 사용.
vi.mock("@/lib/mailer", () => ({ sendPasswordResetCode: vi.fn() }));

type PR = typeof import("@/lib/password-reset");
type UsersMod = typeof import("@/lib/users");
type Prisma = (typeof import("@/lib/prisma"))["prisma"];

let pr: PR;
let users: UsersMod;
let prisma: Prisma;
let sendMock: ReturnType<typeof vi.fn>;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const db = await setupTestDb();
  cleanup = db.cleanup;
  prisma = db.prisma as Prisma;
  pr = await import("@/lib/password-reset");
  users = await import("@/lib/users");
  sendMock = vi.mocked((await import("@/lib/mailer")).sendPasswordResetCode);
});
afterAll(async () => {
  await cleanup();
});

async function approvedMember(email: string) {
  await users.createPendingUser({
    email,
    nickname: email.split("@")[0], // 닉네임 고유 규칙 — 이메일 로컬파트로 구분
    password: "Aa1!aaaa",
  });
  const u = await users.findUserByEmail(email);
  await users.approveUser(u!.id);
}

const wrongOf = (code: string) => (code === "123456" ? "654321" : "123456");

describe("password-reset", () => {
  test("승인 회원: 발송→틀린코드 실패→정답 검증→재설정 성공", async () => {
    await approvedMember("m@x.com");
    sendMock.mockClear();
    await pr.requestPasswordReset("m@x.com");
    expect(sendMock).toHaveBeenCalledTimes(1);
    const code = sendMock.mock.calls[0][1] as string;

    expect(await pr.verifyResetCode("m@x.com", wrongOf(code))).toEqual({
      ok: false,
      error: "코드가 일치하지 않습니다.",
    });
    expect(await pr.verifyResetCode("m@x.com", code)).toEqual({ ok: true });
    expect(await pr.resetPassword("m@x.com", "NewPass1!")).toEqual({
      ok: true,
    });

    expect((await users.authenticateMember("m@x.com", "NewPass1!")).ok).toBe(
      true,
    );
    expect((await users.authenticateMember("m@x.com", "Aa1!aaaa")).ok).toBe(
      false,
    );
  });

  test("이미 사용한 코드로는 재설정 불가(소비됨)", async () => {
    expect(await pr.resetPassword("m@x.com", "Another1!")).toEqual({
      ok: false,
      error: "인증이 필요합니다. 다시 시도해 주세요.",
    });
  });

  test("비회원·미승인 이메일엔 발송하지 않음(존재 비노출)", async () => {
    sendMock.mockClear();
    const res = await pr.requestPasswordReset("nobody@x.com");
    expect(res.expiresAt).toBeInstanceOf(Date);
    expect(sendMock).not.toHaveBeenCalled();

    await users.createPendingUser({
      email: "pend@x.com",
      nickname: "p",
      password: "Aa1!aaaa",
    });
    await pr.requestPasswordReset("pend@x.com");
    expect(sendMock).not.toHaveBeenCalled();
  });

  test("만료된 코드는 검증 실패", async () => {
    await approvedMember("exp@x.com");
    sendMock.mockClear();
    await pr.requestPasswordReset("exp@x.com");
    const code = sendMock.mock.calls[0][1] as string;
    await prisma.passwordResetCode.updateMany({
      where: { email: "exp@x.com" },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await pr.verifyResetCode("exp@x.com", code)).toEqual({
      ok: false,
      error: "코드가 만료되었습니다. 재전송해 주세요.",
    });
  });

  test("시도 5회 초과 시 정답이어도 차단", async () => {
    await approvedMember("att@x.com");
    sendMock.mockClear();
    await pr.requestPasswordReset("att@x.com");
    const code = sendMock.mock.calls[0][1] as string;
    const bad = wrongOf(code);
    for (let i = 0; i < 5; i++) await pr.verifyResetCode("att@x.com", bad);
    expect(await pr.verifyResetCode("att@x.com", code)).toEqual({
      ok: false,
      error: "시도 횟수를 초과했습니다. 재전송해 주세요.",
    });
  });

  test("검증 전에는 재설정 불가", async () => {
    await approvedMember("nv@x.com");
    sendMock.mockClear();
    await pr.requestPasswordReset("nv@x.com");
    expect(await pr.resetPassword("nv@x.com", "NewPass1!")).toEqual({
      ok: false,
      error: "인증이 필요합니다. 다시 시도해 주세요.",
    });
  });

  test("메일 발송 실패해도 요청은 깨지지 않음(코드 저장·검증 가능)", async () => {
    await approvedMember("fail@x.com");
    sendMock.mockClear();
    sendMock.mockRejectedValueOnce(new Error("SES boom"));
    // 예외가 전파되지 않아야 한다.
    await expect(pr.requestPasswordReset("fail@x.com")).resolves.toMatchObject({
      expiresAt: expect.any(Date),
    });
    // 코드는 정상 저장되어 검증 가능(발송만 실패).
    const code = sendMock.mock.calls[0][1] as string;
    expect(await pr.verifyResetCode("fail@x.com", code)).toEqual({ ok: true });
  });

  test("재요청 시 이전 코드는 폐기되고 새 코드만 유효", async () => {
    await approvedMember("re@x.com");
    sendMock.mockClear();
    await pr.requestPasswordReset("re@x.com");
    const old = sendMock.mock.calls[0][1] as string;
    await pr.requestPasswordReset("re@x.com");
    const fresh = sendMock.mock.calls[1][1] as string;
    // 이전 코드는 더 이상 매칭되지 않음(폐기). 새 코드만 유효.
    if (old !== fresh) {
      expect((await pr.verifyResetCode("re@x.com", old)).ok).toBe(false);
    }
    expect(await pr.verifyResetCode("re@x.com", fresh)).toEqual({ ok: true });
  });
});
