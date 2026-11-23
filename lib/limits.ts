// 서버 검증(zod)과 클라이언트 입력 제한이 함께 쓰는 길이 상한. 의존성 없는 모듈이라 클라이언트에서도 가볍게 import.
export const COMMENT_MAX_LENGTH = 2000;

// 비밀번호 규칙 안내(가입·재설정 폼). 규칙 자체는 validation.ts의 passwordField.
export const PASSWORD_HINT =
  "8자 이상, 소문자·대문자·숫자·특수문자를 각 1개 이상 포함하세요.";
