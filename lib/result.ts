// 도메인 계층 공용 결과 타입(성공 시 선택적 value, 실패 시 error 메시지).
export type Result<T = undefined> =
  | { ok: true; value?: T }
  | { ok: false; error: string };
