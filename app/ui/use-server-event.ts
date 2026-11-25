import { useEffect, useRef } from "react";

// 사이트 공통 SSE(/api/events: 알림 미읽음·관리자 신고 수)를 탭당 연결 1개로 공유.
// 헤더 벨과 관리자 내비가 각자 연결을 열면 HTTP/1.1 동시 연결 한도(출처당 6)를 빨리 소모하므로,
// 첫 구독 때 열고 마지막 구독 해제 때 닫는다. EventSource는 쿠키를 자동 전송하고 끊기면 재연결한다.
const URL = "/api/events";
let shared: { es: EventSource; refs: number } | null = null;

function acquire(): EventSource {
  if (!shared) shared = { es: new EventSource(URL), refs: 0 };
  shared.refs++;
  return shared.es;
}

function release() {
  if (!shared) return;
  shared.refs--;
  if (shared.refs === 0) {
    shared.es.close();
    shared = null;
  }
}

// 이름 있는 이벤트(event: name)의 data를 받음. 최신 cb는 ref로 들고 있어 재구독하지 않는다.
export function useServerEvent(name: string, cb: (data: string) => void) {
  const cbRef = useRef(cb);
  useEffect(() => {
    cbRef.current = cb;
  });
  useEffect(() => {
    const es = acquire();
    const listener = (e: Event) => cbRef.current((e as MessageEvent).data);
    es.addEventListener(name, listener);
    return () => {
      es.removeEventListener(name, listener);
      release();
    };
  }, [name]);
}
