// 클라이언트 IP 판별(순수 함수 — proxy와 서버 액션이 공유).
// 운영 nginx는 `X-Forwarded-For $proxy_add_x_forwarded_for`로 클라이언트가 보낸 값 뒤에 실제 원격 주소를
// 덧붙인다(신뢰 홉 1개, 앱 포트는 loopback 바인딩이라 nginx를 거쳐야만 도달). 첫 항목은 클라이언트가 위조할 수
// 있으므로 마지막 항목만 쓴다. 비면 undefined — 앞 항목으로 폴백하지 않는다.
// 앞단에 CDN·프록시가 추가되면 이 전제가 깨지므로 docs/deploy/lightsail.md의 주의와 함께 조정할 것.
export function clientIpFromXff(
  xff: string | null | undefined,
): string | undefined {
  if (!xff) return undefined;
  const parts = xff.split(",");
  return parts[parts.length - 1]?.trim() || undefined;
}
