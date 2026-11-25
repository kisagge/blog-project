// 폼 서버 액션 공용 상태: 필드 에러(errors) + 일반 에러(error) + 완료 플래그(done)
// + 실패 시 돌려주는 제출값(values). useActionState<FormState, FormData>로 사용.
// values: React 19는 action 제출 후 비제어 폼을 초기화하므로, 실패 응답에 제출값을 담아
// 입력의 defaultValue로 다시 채운다(입력 유지). 비밀번호 같은 민감값은 담지 않는다.
export type FormState =
  | {
      errors?: Record<string, string[]>;
      error?: string;
      done?: boolean;
      values?: Record<string, string>;
    }
  | undefined;

// 일반 에러만 다루는 액션(로그인·코드요청 등) 공용 상태.
export type SimpleFormState = { error?: string } | undefined;

// 로그인 안 된 요청에 대한 공용 안내(회원 전용 액션).
export const LOGIN_REQUIRED = "로그인이 필요합니다.";

// 실패 응답에 담을 제출값(names에 지정한 필드만 — 민감값 제외는 호출부 책임).
export function submittedValues(
  formData: FormData,
  names: readonly string[],
): Record<string, string> {
  return Object.fromEntries(
    names.map((n) => [n, String(formData.get(n) ?? "")]),
  );
}
