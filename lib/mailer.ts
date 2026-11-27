import "server-only";
import nodemailer from "nodemailer";
import {
  passwordResetEmail,
  signupApprovedEmail,
  signupRejectedEmail,
  type Mail,
} from "@/lib/email-template";
import { SITE_NAME } from "@/lib/share";

const FROM = process.env.SMTP_FROM ?? `${SITE_NAME} <no-reply@byjang.local>`;

// SMTP 설정이 없으면 null → 콘솔 폴백(로컬/CI). 운영에선 .env에 SMTP_* 지정.
function transport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

// 전송. SMTP 미설정이면 콘솔에 남기고 끝(fallbackLog — 로컬 개발에서 내용 확인용).
async function send(to: string, mail: Mail, fallbackLog: string) {
  const t = transport();
  if (!t) {
    console.log(`[mailer] SMTP 미설정 — ${to} ${fallbackLog}`);
    return;
  }
  await t.sendMail({ from: FROM, to, ...mail });
}

export async function sendPasswordResetCode(email: string, code: string) {
  await send(email, passwordResetEmail(code), `재설정 코드: ${code}`);
}

// 가입 승인·거절 결과 안내.
export async function sendSignupResult(
  email: string,
  nickname: string,
  result: "approved" | "rejected",
) {
  const mail =
    result === "approved"
      ? signupApprovedEmail(nickname)
      : signupRejectedEmail(nickname);
  await send(email, mail, mail.subject);
}
