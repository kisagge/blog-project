import { SITE_NAME, SITE_ORIGIN, SITE_DESCRIPTION } from "@/lib/share";

// 비밀번호 재설정 코드 메일(브랜드 HTML + 텍스트 폴백). 이메일 클라이언트 안전 원칙:
// 테이블 레이아웃 + 인라인 스타일 only + 외부 이미지/웹폰트/JS 0(차단·의존 회피).
// 순수 함수(server-only 아님) — 단위 테스트 용이.

const SUBJECT = "[BY Playground] 비밀번호 재설정 코드";
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Apple SD Gothic Neo','Malgun Gothic',sans-serif";

export function passwordResetEmail(code: string): {
  subject: string;
  text: string;
  html: string;
} {
  const text = `비밀번호 재설정 인증 코드: ${code}\n\n3분 이내에 입력해 주세요.\n본인이 요청하지 않았다면 이 메일을 무시하세요.`;

  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>비밀번호 재설정 코드</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:${FONT};">
<span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">비밀번호 재설정 인증 코드 ${code} — 3분 이내에 입력해 주세요.</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;">
<tr><td style="padding:22px 28px;border-bottom:1px solid #f1f1f4;font-family:${FONT};font-size:16px;font-weight:700;color:#18181b;">${SITE_NAME}</td></tr>
<tr><td style="padding:28px;font-family:${FONT};">
<h1 style="margin:0 0 8px;font-size:20px;line-height:1.4;color:#18181b;">비밀번호 재설정</h1>
<p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#52525b;">아래 인증 코드를 입력해 비밀번호를 재설정하세요.</p>
<div style="text-align:center;margin:0 0 22px;">
<span style="display:inline-block;padding:14px 22px 14px 30px;background:#fef3c7;border:1px solid #fde68a;border-radius:10px;font-family:'Courier New',Consolas,monospace;font-size:30px;font-weight:700;letter-spacing:8px;color:#b45309;">${code}</span>
</div>
<p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#71717a;">⏱ <strong style="color:#52525b;">3분 이내</strong>에 입력해 주세요.</p>
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.</p>
</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #f1f1f4;font-family:${FONT};">
<p style="margin:0;font-size:12px;line-height:1.5;color:#a1a1aa;"><a href="${SITE_ORIGIN}" style="color:#71717a;text-decoration:none;font-weight:600;">${SITE_NAME}</a> · ${SITE_DESCRIPTION}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject: SUBJECT, text, html };
}
