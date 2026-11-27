import { kstDay } from "@/lib/kst";

type View = { type: "site" } | { type: "feed" | "df"; id: string };

// 조회·방문 기록 전송(응답은 쓰지 않음). keepalive라 페이지를 떠나는 중에도 전송되고,
// 응답의 방문자 쿠키(Set-Cookie)도 반영된다. text/plain이라 preflight 없음.
export function sendView(view: View): void {
  void fetch("/api/view", {
    method: "POST",
    body: JSON.stringify(view),
    headers: { "Content-Type": "text/plain" },
    keepalive: true,
  }).catch(() => {});
}

// 사이트 방문은 브라우저당 하루(KST) 1번만 보낸다 — 서버도 방문자·하루로 1건만 세므로 같은 날 재전송은 낭비.
const SITE_KEY = "site-visit-day";
export function sendSiteVisitOncePerDay(): void {
  const today = kstDay();
  try {
    if (localStorage.getItem(SITE_KEY) === today) return;
    localStorage.setItem(SITE_KEY, today);
  } catch {
    // 저장소 차단(사생활 보호 모드 등) — 그냥 보낸다(서버가 중복을 걸러냄).
  }
  sendView({ type: "site" });
}
