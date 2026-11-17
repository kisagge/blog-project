// 웹 푸시 구독 endpoint 허용 목록. 서버가 이 주소로 직접 HTTP 요청(web-push 발송)을 보내므로,
// 임의 주소를 받으면 내부망·클라우드 메타데이터로 요청을 보내게 할 수 있다(SSRF).
// 브라우저 푸시 서비스 도메인(https·기본 포트)만 허용한다.
const PUSH_SERVICE_DOMAINS = [
  "fcm.googleapis.com", // Chrome·Edge(Chromium)·Opera 등
  "android.googleapis.com", // 구형 GCM
  "push.services.mozilla.com", // Firefox
  "push.apple.com", // Safari
  "notify.windows.com", // 구형 Edge(WNS)
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let u: URL;
  try {
    u = new URL(endpoint);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.port !== "" || u.username || u.password)
    return false;
  const host = u.hostname.toLowerCase();
  return PUSH_SERVICE_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}
