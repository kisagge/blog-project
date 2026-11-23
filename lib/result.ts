// 도메인 계층 공용 결과 타입. 실패는 사용자에게 보일 error 메시지.
// Result: 성공 시 value 선택(없어도 됨) / ValueResult: 성공 시 value 필수(생성된 id·slug 등).
export type Result<T = undefined> =
  { ok: true; value?: T } | { ok: false; error: string };
export type ValueResult<T> =
  { ok: true; value: T } | { ok: false; error: string };
