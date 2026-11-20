// 이메일 비교·저장 키 정규화(앞뒤 공백 제거 + 소문자). 회원·재설정 코드·요청 제한 키가 같은 형태를 쓴다.
// 폼 입력은 zod(validation.ts의 emailField)가 같은 정규화를 하고, 라이브러리 함수는 임의 입력에 대비해 다시 적용한다.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
