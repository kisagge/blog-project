import { z } from "zod";
import { isAllowedPushEndpoint } from "@/lib/push-endpoint";
import { UPLOAD_URL_RE } from "@/lib/upload";
import { COMMENT_MAX_LENGTH } from "@/lib/limits";

// 폼 필드별 에러 목록(FormState.errors 모양). zod 4에서 폐기 예정인 ZodError#flatten() 대신 z.flattenError.
export function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors;
}

// 폼 공용 필드.
const titleField = z.string().trim().min(1, "제목을 입력하세요.");
// slug: 글·시리즈 공용 규칙(URL 식별자).
const slugField = z
  .string()
  .trim()
  .regex(/^[a-z0-9-]+$/, "slug는 소문자·숫자·하이픈(-)만 사용할 수 있습니다.");
// 이메일: lib/email의 normalizeEmail과 같은 정규화(공백 제거 + 소문자).
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email("올바른 이메일을 입력하세요.");

export const FeedFormSchema = z.object({
  title: titleField,
  slug: slugField,
  summary: z.string().trim().optional(),
  content: z.string().min(1, "본문을 입력하세요."),
  visibility: z.enum(["public", "members", "private"]),
  tags: z.string().trim().optional(), // 콤마 구분 원본(정규화·상한은 parseTags)
  seriesId: z.string().trim().optional(), // "" = 미배정(시리즈 select 값)
  scheduledAt: z.string().trim().optional(), // KST 벽시계 "YYYY-MM-DDTHH:MM" 또는 ""(생성 시에만, 즉시=빈값)
});

// FormData → 파싱 입력 객체. visibility는 select 값(없으면 비공개).
export function feedFormToObject(formData: FormData) {
  const v = String(formData.get("visibility") ?? "private");
  return {
    title: String(formData.get("title") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    content: String(formData.get("content") ?? ""),
    visibility: v === "public" || v === "members" ? v : "private",
    tags: String(formData.get("tags") ?? ""),
    seriesId: String(formData.get("seriesId") ?? ""),
    scheduledAt: String(formData.get("scheduledAt") ?? ""),
  };
}

// 시리즈 생성·수정 입력(관리자). slug는 글 slug와 동일 규칙.
export const SeriesSchema = z.object({
  title: titleField,
  slug: slugField,
  description: z.string().trim().optional(),
});

export const CommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "내용을 입력하세요.")
    .max(COMMENT_MAX_LENGTH, `댓글은 ${COMMENT_MAX_LENGTH}자 이하여야 합니다.`),
});

// 콘텐츠 신고: 사유(필수) + 상세(선택, 500자).
export const ReportSchema = z.object({
  reason: z.enum(["spam", "abuse", "illegal", "etc"], {
    message: "신고 사유를 선택하세요.",
  }),
  detail: z
    .string()
    .trim()
    .max(500, "상세 설명은 500자 이하여야 합니다.")
    .optional(),
});

// 비밀번호 규칙: 8자 이상 + 소문자·대문자·숫자·특수문자 각 1개 이상. 가입·재설정 공용(폼 안내 문구는 limits.ts PASSWORD_HINT).
const passwordField = z
  .string()
  .min(8, "비밀번호는 8자 이상이어야 합니다.")
  .regex(/[a-z]/, "소문자를 1개 이상 포함하세요.")
  .regex(/[A-Z]/, "대문자를 1개 이상 포함하세요.")
  .regex(/[0-9]/, "숫자를 1개 이상 포함하세요.")
  .regex(/[^A-Za-z0-9]/, "특수문자를 1개 이상 포함하세요.");

// 닉네임 규칙: 가입·내 정보 수정 공용.
const nicknameField = z
  .string()
  .trim()
  .min(1, "닉네임을 입력하세요.")
  .max(20, "닉네임은 20자 이하.");

// 자기소개: 선택, 최대 160자.
const bioField = z.string().trim().max(160, "자기소개는 160자 이하.");

// 아바타: 빈 문자열(제거) 또는 우리 업로드 경로만 — 외부 URL·javascript: 등 주입 차단.
const avatarUrlField = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || UPLOAD_URL_RE.test(v),
    "올바른 아바타 이미지가 아닙니다.",
  );

// 프로필(내 정보) 수정 공용: 닉네임 + 자기소개 + 아바타.
export const ProfileSchema = z.object({
  nickname: nicknameField,
  bio: bioField,
  avatarUrl: avatarUrlField,
});

// 회원 글(임시저장·게시) 입력. 본문은 마크다운(외부 이미지 URL 허용, 업로드 없음).
export const MemberPostSchema = z.object({
  tags: z.string().trim().optional(),
  title: z
    .string()
    .trim()
    .min(1, "제목을 입력하세요.")
    .max(120, "제목은 120자 이하여야 합니다."),
  content: z
    .string()
    .trim()
    .min(1, "본문을 입력하세요.")
    .max(20000, "본문은 2만 자 이하여야 합니다."),
});

export const SignupSchema = z.object({
  email: emailField,
  nickname: nicknameField,
  password: passwordField,
});

// 비밀번호 재설정 단계별 스키마.
export const ResetEmailSchema = z.object({
  email: emailField,
});

export const ResetCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "6자리 숫자 코드를 입력하세요."),
});

export const ResetPasswordSchema = z
  .object({
    password: passwordField,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["confirm"],
  });

// 소개 페이지(/about) 본문 — 관리자 편집. 빈 값은 "비공개(페이지 숨김)"로 허용.
export const ABOUT_MAX_LENGTH = 20_000;
export const AboutSchema = z.object({
  content: z
    .string()
    .max(
      ABOUT_MAX_LENGTH,
      `소개는 ${ABOUT_MAX_LENGTH.toLocaleString()}자 이하로 입력하세요.`,
    ),
});

// 웹 푸시 구독(브라우저 PushSubscription.toJSON()). endpoint는 푸시 서비스 허용 목록만(SSRF 방지),
// 키는 base64url — p256dh는 65바이트 공개키(≈87자), auth는 16바이트(≈22자). 여유를 두되 과대 입력은 거부.
const base64url = /^[A-Za-z0-9_-]+={0,2}$/;
export const PushSubscriptionSchema = z.object({
  endpoint: z.string().max(1024).refine(isAllowedPushEndpoint),
  keys: z.object({
    p256dh: z.string().min(80).max(100).regex(base64url),
    auth: z.string().min(16).max(32).regex(base64url),
  }),
});
