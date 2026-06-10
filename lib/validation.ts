import { z } from "zod";

export const FeedFormSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력하세요."),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "slug는 소문자·숫자·하이픈(-)만 사용할 수 있습니다."),
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
    published: formData.get("published") === "on" || formData.get("published") === "true",
  };
}

export const SignupSchema = z.object({
  email: z.string().trim().toLowerCase().email("올바른 이메일을 입력하세요."),
  nickname: z.string().trim().min(1, "닉네임을 입력하세요.").max(20, "닉네임은 20자 이하."),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
});
export type SignupValues = z.infer<typeof SignupSchema>;
