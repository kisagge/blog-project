import "server-only";
import nodemailer from "nodemailer";
import { passwordResetEmail } from "@/lib/email-template";

const FROM = process.env.SMTP_FROM ?? "BY Playground <no-reply@byjang.local>";

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

export async function sendPasswordResetCode(email: string, code: string) {
  const { subject, text, html } = passwordResetEmail(code);
  const t = transport();
  if (!t) {
    console.log(`[mailer] SMTP 미설정 — ${email} 재설정 코드: ${code}`);
    return;
  }
  await t.sendMail({ from: FROM, to: email, subject, text, html });
}
