import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { act, render } from "@testing-library/react";
import {
  FeedEventsProvider,
  useFeedEvent,
  type ProviderEvent,
} from "@/app/feed/feed-events-context";

// jsdom엔 EventSource가 없어 인스턴스를 캡처하는 가짜를 주입해 onopen/onmessage를 흉내낸다.
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  closed = false;
  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
  }
}

function Probe({ sink }: { sink: ProviderEvent[] }) {
  useFeedEvent((ev) => sink.push(ev));
  return null;
}

describe("FeedEventsProvider 재접속 재동기화", () => {
  const orig = globalThis.EventSource;
  beforeEach(() => {
    FakeEventSource.instances = [];
    // @ts-expect-error 테스트용 주입
    globalThis.EventSource = FakeEventSource;
  });
  afterEach(() => {
    globalThis.EventSource = orig;
  });

  test("첫 연결은 resync 없음, 재접속(onopen 재발생) 시 resync 1건", () => {
    const sink: ProviderEvent[] = [];
    render(
      <FeedEventsProvider feedId="f1">
        <Probe sink={sink} />
      </FeedEventsProvider>,
    );
    const es = FakeEventSource.instances[0];
    expect(es.url).toContain("feed=f1");
    act(() => es.onopen?.()); // 첫 연결
    expect(sink.filter((e) => e.kind === "resync")).toHaveLength(0);
    act(() => es.onopen?.()); // 재접속
    expect(sink.filter((e) => e.kind === "resync")).toHaveLength(1);
  });

  test("서버 FeedEvent(onmessage)는 그대로 소비자에 전달", () => {
    const sink: ProviderEvent[] = [];
    render(
      <FeedEventsProvider feedId="f2">
        <Probe sink={sink} />
      </FeedEventsProvider>,
    );
    const es = FakeEventSource.instances[0];
    act(() =>
      es.onmessage?.({ data: JSON.stringify({ kind: "feedLike", count: 7 }) }),
    );
    expect(sink).toContainEqual({ kind: "feedLike", count: 7 });
  });

  test("언마운트 시 EventSource close", () => {
    const { unmount } = render(
      <FeedEventsProvider feedId="f3">
        <Probe sink={[]} />
      </FeedEventsProvider>,
    );
    const es = FakeEventSource.instances[0];
    expect(es.closed).toBe(false);
    unmount();
    expect(es.closed).toBe(true);
  });
});
