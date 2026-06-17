"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { FeedEvent } from "@/lib/comments";

// 한 글 상세 페이지의 피드 SSE 이벤트(`/api/feed-events`)를 단일 EventSource로 받아
// 등록된 리스너에 팬아웃. 댓글 섹션과 좋아요 버튼이 형제라도 연결 1개를 공유한다
// (공개 글은 익명 뷰어가 많아 연결 중복을 피한다). 각 소비자는 kind로 관심 이벤트만 처리.
// provider가 소비자에 전달하는 이벤트: 서버 FeedEvent + 재접속 재동기화 신호.
export type ProviderEvent = FeedEvent | { kind: "resync" };
type Listener = (ev: ProviderEvent) => void;
type Ctx = { subscribe: (cb: Listener) => () => void };

const FeedEventsContext = createContext<Ctx | null>(null);

export function FeedEventsProvider({
  feedId,
  children,
}: {
  feedId: string;
  children: ReactNode;
}) {
  const listeners = useRef<Set<Listener>>(new Set());

  // 안정적 ctx 값(렌더마다 동일, lazy init) — listeners ref 기반 구독/해지라
  // 소비자 effect를 재실행시키지 않는다.
  const [ctx] = useState<Ctx>(() => ({
    subscribe(cb) {
      listeners.current.add(cb);
      return () => listeners.current.delete(cb);
    },
  }));

  useEffect(() => {
    const es = new EventSource(`/api/feed-events?feed=${feedId}`);
    // 첫 연결은 SSR 데이터가 신선 → 리페치 불필요. 재접속(onopen 재발생) 시에만
    // 끊긴 동안의 유실을 메우도록 소비자에 resync 신호를 보낸다.
    let opened = false;
    es.onopen = () => {
      if (opened) listeners.current.forEach((cb) => cb({ kind: "resync" }));
      opened = true;
    };
    es.onmessage = (e) => {
      let ev: FeedEvent;
      try {
        ev = JSON.parse(e.data) as FeedEvent;
      } catch {
        return;
      }
      listeners.current.forEach((cb) => cb(ev));
    };
    return () => es.close();
  }, [feedId]);

  return (
    <FeedEventsContext.Provider value={ctx}>
      {children}
    </FeedEventsContext.Provider>
  );
}

// 마운트 동안 provider의 피드 이벤트를 구독. 최신 cb는 ref로 들고 있어
// cb 신원이 매 렌더 바뀌어도 재구독하지 않는다.
export function useFeedEvent(cb: Listener): void {
  const ctx = useContext(FeedEventsContext);
  const cbRef = useRef(cb);
  useEffect(() => {
    cbRef.current = cb;
  });
  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe((ev) => cbRef.current(ev));
  }, [ctx]);
}
