import { SITE_NAME, SITE_ORIGIN, SITE_DESCRIPTION } from "@/lib/share";
import { RESET_CODE_TTL_MINUTES } from "@/lib/reset-policy";

// 사이트 메일(브랜드 HTML + 텍스트 폴백). 이메일 클라이언트 안전 원칙:
// 테이블 레이아웃 + 인라인 스타일 only + 외부 이미지/웹폰트/JS 0(차단·의존 회피).
// 순수 함수(server-only 아님) — 단위 테스트 용이.

export type Mail = { subject: string; text: string; html: string };

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Apple SD Gothic Neo','Malgun Gothic',sans-serif";

// 사용자 입력(닉네임 등)을 HTML에 넣을 때 — 메일 마크업을 바꾸지 못하게.
function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// 공용 틀: 머리(사이트명) · 본문(제목 + bodyHtml) · 꼬리(사이트 링크). preheader는 받은편지함 미리보기 문구.
function layout({
  title,
  preheader,
  heading,
  bodyHtml,
}: {
  title: string;
  preheader: string;
  heading: string;
  bodyHtml: string;
}): string {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:${FONT};">
<span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;">
<tr><td style="padding:22px 28px;border-bottom:1px solid #f1f1f4;font-family:${FONT};font-size:16px;font-weight:700;color:#18181b;">${SITE_NAME}</td></tr>
<tr><td style="padding:28px;font-family:${FONT};">
<h1 style="margin:0 0 8px;font-size:20px;line-height:1.4;color:#18181b;">${heading}</h1>
${bodyHtml}
</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #f1f1f4;font-family:${FONT};">
<p style="margin:0;font-size:12px;line-height:1.5;color:#a1a1aa;"><a href="${SITE_ORIGIN}" style="color:#71717a;text-decoration:none;font-weight:600;">${SITE_NAME}</a> · ${SITE_DESCRIPTION}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

const P = "margin:0 0 22px;font-size:14px;line-height:1.6;color:#52525b;";
const NOTE = "margin:0;font-size:13px;line-height:1.6;color:#71717a;";

function button(href: string, label: string): string {
  return `<div style="text-align:center;margin:0 0 22px;">
<a href="${href}" style="display:inline-block;padding:12px 22px;background:#18181b;border-radius:999px;font-family:${FONT};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${label}</a>
</div>`;
}

export function passwordResetEmail(code: string): Mail {
  const text = `비밀번호 재설정 인증 코드: ${code}\n\n${RESET_CODE_TTL_MINUTES}분 이내에 입력해 주세요.\n본인이 요청하지 않았다면 이 메일을 무시하세요.`;
  const html = layout({
    title: "비밀번호 재설정 코드",
    preheader: `비밀번호 재설정 인증 코드 ${code} — ${RESET_CODE_TTL_MINUTES}분 이내에 입력해 주세요.`,
    heading: "비밀번호 재설정",
    bodyHtml: `<p style="${P}">아래 인증 코드를 입력해 비밀번호를 재설정하세요.</p>
<div style="text-align:center;margin:0 0 22px;">
<span style="display:inline-block;padding:14px 22px 14px 30px;background:#fef3c7;border:1px solid #fde68a;border-radius:10px;font-family:'Courier New',Consolas,monospace;font-size:30px;font-weight:700;letter-spacing:8px;color:#b45309;">${code}</span>
</div>
<p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#71717a;">⏱ <strong style="color:#52525b;">${RESET_CODE_TTL_MINUTES}분 이내</strong>에 입력해 주세요.</p>
<p style="${NOTE}">본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.</p>`,
  });
  return { subject: `[${SITE_NAME}] 비밀번호 재설정 코드`, text, html };
}

// 가입 승인 알림. 로그인 링크 포함.
export function signupApprovedEmail(nickname: string): Mail {
  const url = `${SITE_ORIGIN}/signin`;
  const text = `${nickname}님, 가입 신청이 승인되었습니다.\n\n지금 로그인해 댓글·글쓰기·팔로우를 이용해 보세요.\n${url}`;
  const html = layout({
    title: "가입 승인",
    preheader: `${escapeHtml(nickname)}님, 가입 신청이 승인되었습니다.`,
    heading: "가입이 승인되었습니다",
    bodyHtml: `<p style="${P}"><strong style="color:#18181b;">${escapeHtml(nickname)}</strong>님, 가입 신청이 승인되었습니다. 지금 로그인해 댓글·글쓰기·팔로우를 이용해 보세요.</p>
${button(url, "로그인하기")}
<p style="${NOTE}">본인이 신청하지 않았다면 이 메일을 무시하셔도 됩니다.</p>`,
  });
  return { subject: `[${SITE_NAME}] 가입이 승인되었습니다`, text, html };
}

// 가입 거절 알림. 거절 사유는 관리자 참고용이라 담지 않고(스키마 정책), 재신청 가능함을 알린다.
export function signupRejectedEmail(nickname: string): Mail {
  const url = `${SITE_ORIGIN}/signup`;
  const text = `${nickname}님, 이번 가입 신청은 승인되지 않았습니다.\n\n같은 이메일로 다시 신청할 수 있습니다.\n${url}`;
  const html = layout({
    title: "가입 신청 결과",
    preheader: `${escapeHtml(nickname)}님의 가입 신청 결과를 알려 드립니다.`,
    heading: "가입 신청 결과",
    bodyHtml: `<p style="${P}"><strong style="color:#18181b;">${escapeHtml(nickname)}</strong>님, 이번 가입 신청은 승인되지 않았습니다. 같은 이메일로 다시 신청할 수 있습니다.</p>
${button(url, "다시 신청하기")}
<p style="${NOTE}">본인이 신청하지 않았다면 이 메일을 무시하셔도 됩니다.</p>`,
  });
  return { subject: `[${SITE_NAME}] 가입 신청 결과 안내`, text, html };
}
