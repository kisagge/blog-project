// 운영 부팅 시 비밀값 점검(instrumentation). .env.example의 예시값은 저장소에 공개돼 있어,
// 그대로 쓰면 누구나 세션 키로 관리자 JWT를 서명할 수 있다. 문제 설명엔 값 자체를 담지 않는다(로그 유출 방지).
const EXAMPLE_SESSION_SECRET = "generate-with-openssl-rand-base64-32";
const EXAMPLE_ADMIN_PASSWORD = "change-me";

export function productionSecretProblems(
  env: Record<string, string | undefined>,
): string[] {
  const problems: string[] = [];
  const secret = env.SESSION_SECRET ?? "";
  if (secret.length < 32 || secret === EXAMPLE_SESSION_SECRET)
    problems.push(
      "SESSION_SECRET이 없거나 32자 미만이거나 .env.example 예시값입니다(openssl rand -base64 32로 생성).",
    );
  const password = env.ADMIN_PASSWORD ?? "";
  if (password === "" || password === EXAMPLE_ADMIN_PASSWORD)
    problems.push("ADMIN_PASSWORD가 없거나 .env.example 예시값입니다.");
  return problems;
}
