// 비밀번호 재설정 시간 정책. 코드 발급·검증(lib/password-reset), 단계 쿠키(lib/reset-token),
// 안내 메일(lib/email-template)이 같은 값을 쓴다. 의존성 없는 순수 상수.
export const RESET_CODE_TTL_MS = 3 * 60 * 1000; // 코드 유효시간
export const RESET_VERIFY_GRACE_MS = 15 * 60 * 1000; // 코드 검증 후 새 비밀번호 입력 허용 시간
export const RESET_RESEND_COOLDOWN_MS = 60 * 1000; // 같은 이메일 재발송 최소 간격(메일 폭탄 방지)

export const RESET_CODE_TTL_MINUTES = RESET_CODE_TTL_MS / 60_000;
