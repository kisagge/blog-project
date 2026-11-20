// 서버가 발급하는 쿠키(세션·재설정 단계·방문자 ID) 공용 보안 옵션. 수명은 호출부가 붙인다.
export function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}
