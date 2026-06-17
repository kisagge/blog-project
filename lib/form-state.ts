// 폼 서버 액션 공용 상태: 필드 에러(errors) + 일반 에러(error) + 완료 플래그(done).
// useActionState<FormState, FormData>로 사용.
export type FormState =
  | { errors?: Record<string, string[]>; error?: string; done?: boolean }
  | undefined;

// 일반 에러만 다루는 액션(로그인·코드요청 등) 공용 상태.
export type SimpleFormState = { error?: string } | undefined;
