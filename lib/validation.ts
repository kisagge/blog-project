import { z } from "zod";

export const FeedFormSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력하세요."),
  slug: z
    .string()
    .trim()
    .regex(
      /^[a-z0-9-]+$/,
      "slug는 소문자·숫자·하이픈(-)만 사용할 수 있습니다.",
    ),
  summary: z.string().trim().optional(),
  content: z.string().min(1, "본문을 입력하세요."),
  visibility: z.enum(["public", "members", "private"]),
  tags: z.string().trim().optional(), // 콤마 구분 원본(정규화·상한은 parseTags)
});

export type FeedFormValues = z.infer<typeof FeedFormSchema>;

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
  };
}

export const CommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "내용을 입력하세요.")
    .max(2000, "댓글은 2000자 이하여야 합니다."),
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

// 비밀번호 규칙: 8자 이상 + 소문자·대문자·숫자·특수문자 각 1개 이상. 가입·재설정 공용.
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

export const NicknameSchema = z.object({ nickname: nicknameField });

// 자기소개: 선택, 최대 160자.
const bioField = z.string().trim().max(160, "자기소개는 160자 이하.");

// 아바타: 빈 문자열(제거) 또는 우리 업로드 경로만 — 외부 URL·javascript: 등 주입 차단.
const avatarUrlField = z
  .string()
  .trim()
  .refine(
    (v) =>
      v === "" || /^\/uploads\/[a-f0-9-]+\.(jpg|jpeg|png|webp)(\?.*)?$/.test(v),
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
  email: z.string().trim().toLowerCase().email("올바른 이메일을 입력하세요."),
  nickname: nicknameField,
  password: passwordField,
});
export type SignupValues = z.infer<typeof SignupSchema>;

// 비밀번호 재설정 단계별 스키마.
export const ResetEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("올바른 이메일을 입력하세요."),
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
