import "server-only";
import type { CommentEvent } from "@/lib/comments";

// 인메모리 채널 버스(단일 컨테이너 전제 — rate-limit Map과 동형).
// 열린 SSE 연결로 이벤트를 팬아웃. 다중 인스턴스로 확장 시엔 Redis pub/sub 등 외부 버스 필요.
//
// globalThis에 고정: Next App Router는 SSE 라우트 핸들러(구독)와 서버 액션(발행)을
// 서로 다른 서버 번들/모듈 인스턴스로 평가할 수 있어, 평범한 모듈 레벨 Map이면
// publish와 subscribe가 다른 Map을 보게 돼 이벤트가 전달되지 않는다(운영 빌드에서 발현).
// prisma(lib/prisma.ts)와 동일한 globalThis 싱글톤 패턴으로 프로세스 전역 단일 인스턴스 보장.
type Channels = Map<string, Set<(data: unknown) => void>>;
const g = globalThis as unknown as { __eventChannels?: Channels };
const channels: Channels = (g.__eventChannels ??= new Map());

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

// ── 미처리 신고 수(관리자 단일 채널) ──
export function subscribeReports(cb: (count: number) => void): () => void {
  return subscribe("reports", (d) => cb(d as number));
}
export function publishReports(count: number): void {
  publish("reports", count);
}
