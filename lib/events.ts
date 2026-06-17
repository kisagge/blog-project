import "server-only";
import type { CommentEvent } from "@/lib/comments";

// 인메모리 채널 버스(단일 컨테이너 전제 — rate-limit Map과 동형).
// 열린 SSE 연결로 이벤트를 팬아웃. 다중 인스턴스로 확장 시엔 Redis pub/sub 등 외부 버스 필요.
const channels = new Map<string, Set<(data: unknown) => void>>();

function subscribe(channel: string, cb: (data: unknown) => void): () => void {
  let set = channels.get(channel);
  if (!set) channels.set(channel, (set = new Set()));
  set.add(cb);
  return () => {
    const s = channels.get(channel);
    if (!s) return;
    s.delete(cb);
    if (s.size === 0) channels.delete(channel);
  };
}

function publish(channel: string, data: unknown): void {
  channels.get(channel)?.forEach((cb) => cb(data));
}

// ── 알림 미읽음 수(per-user) ──
export function subscribeUnread(
  userId: string,
  cb: (unread: number) => void,
): () => void {
  return subscribe(`user:${userId}`, (d) => cb(d as number));
}
export function publishUnread(userId: string, unread: number): void {
  publish(`user:${userId}`, unread);
}

// ── 댓글 이벤트(per-feed) ──
export function subscribeComment(
  feedId: string,
  cb: (ev: CommentEvent) => void,
): () => void {
  return subscribe(`feed:${feedId}`, (d) => cb(d as CommentEvent));
}
export function publishComment(feedId: string, ev: CommentEvent): void {
  publish(`feed:${feedId}`, ev);
}
