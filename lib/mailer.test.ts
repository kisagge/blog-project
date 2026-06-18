import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

// vi.hoisted: 팩토리가 import보다 위로 호이스팅되므로 mock 함수도 함께 호이스팅해야 TDZ 회피.
const { sendMail, createTransport } = vi.hoisted(() => {
  const sendMail = vi.fn();
  return { sendMail, createTransport: vi.fn(() => ({ sendMail })) };
});
vi.mock("nodemailer", () => ({ default: { createTransport } }));

import { sendPasswordResetCode } from "@/lib/mailer";

const hadHost = process.env.SMTP_HOST;
beforeEach(() => {
  sendMail.mockClear();
  createTransport.mockClear();
});
afterEach(() => {
  if (hadHost === undefined) delete process.env.SMTP_HOST;
  else process.env.SMTP_HOST = hadHost;
});

describe("mailer", () => {
  test("SMTP 미설정 → console 폴백(전송 안 함·throw 없음)", async () => {
    delete process.env.SMTP_HOST;
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await expect(
      sendPasswordResetCode("a@x.com", "123456"),
    ).resolves.toBeUndefined();
    expect(createTransport).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  test("SMTP 설정 → sendMail에 to·subject·코드 전달", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    await sendPasswordResetCode("a@x.com", "654321");
    expect(createTransport).toHaveBeenCalled();
    const arg = sendMail.mock.calls[0][0];
    expect(arg.to).toBe("a@x.com");
    expect(arg.subject).toContain("비밀번호");
    expect(arg.text).toContain("654321");
  });
});
