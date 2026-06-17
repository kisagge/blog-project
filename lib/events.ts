import "server-only";

// 인메모리 per-user 이벤트 버스(단일 컨테이너 전제 — rate-limit Map과 동형).
// 알림 unread 카운트 변화를 열린 SSE 연결로 팬아웃. 다중 인스턴스로 확장 시엔
// Redis pub/sub 등 외부 버스 필요(현 구성 밖).
const channels = new Map<string, Set<(unread: number) => void>>();

// 구독 등록 + 해제 함수 반환. SSE 연결마다 1개(다중 탭이면 userId당 여러 개).
export function subscribeUnread(
  userId: string,
  cb: (unread: number) => void,
): () => void {
  let set = channels.get(userId);
  if (!set) channels.set(userId, (set = new Set()));
  set.add(cb);
  return () => {
    const s = channels.get(userId);
    if (!s) return;
    s.delete(cb);
    if (s.size === 0) channels.delete(userId);
  };
}

// 해당 회원의 모든 열린 연결에 새 unread 카운트 전달.
export function publishUnread(userId: string, unread: number): void {
  channels.get(userId)?.forEach((cb) => cb(unread));
}
