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
  published: z.boolean(),
});

export type FeedFormValues = z.infer<typeof FeedFormSchema>;

// FormData → 파싱 입력 객체 (체크박스는 존재 여부로 boolean)
export function feedFormToObject(formData: FormData) {
  return {
    title: String(formData.get("title") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    content: String(formData.get("content") ?? ""),
    published:
      formData.get("published") === "on" ||
      formData.get("published") === "true",
  };
}

export const CommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "내용을 입력하세요.")
    .max(2000, "댓글은 2000자 이하여야 합니다."),
});

// 비밀번호 규칙: 8자 이상 + 소문자·대문자·숫자·특수문자 각 1개 이상. 가입·재설정 공용.
const passwordField = z
  .string()
  .min(8, "비밀번호는 8자 이상이어야 합니다.")
  .regex(/[a-z]/, "소문자를 1개 이상 포함하세요.")
  .regex(/[A-Z]/, "대문자를 1개 이상 포함하세요.")
  .regex(/[0-9]/, "숫자를 1개 이상 포함하세요.")
  .regex(/[^A-Za-z0-9]/, "특수문자를 1개 이상 포함하세요.");

export const SignupSchema = z.object({
  email: z.string().trim().toLowerCase().email("올바른 이메일을 입력하세요."),
  nickname: z
    .string()
    .trim()
    .min(1, "닉네임을 입력하세요.")
    .max(20, "닉네임은 20자 이하."),
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
