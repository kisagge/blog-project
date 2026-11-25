import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { useState } from "react";
import { FakeEventSource } from "@/test/helpers";
import { useServerEvent } from "@/app/ui/use-server-event";

function Counter({ name, label }: { name: string; label: string }) {
  const [n, setN] = useState(0);
  useServerEvent(name, (data) => setN(Number(data)));
  return (
    <span>
      {label}:{n}
    </span>
  );
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
});
afterEach(() => vi.unstubAllGlobals());

describe("useServerEvent", () => {
  test("여러 구독자가 /api/events 연결 1개를 공유하고, 마지막 구독 해제 시 닫음", () => {
    const { container, rerender, unmount } = render(
      <>
        <Counter name="unread" label="벨" />
        <Counter name="reports" label="신고" />
      </>,
    );
    expect(FakeEventSource.instances).toHaveLength(1);
    const es = FakeEventSource.instances[0];
    expect(es.url).toBe("/api/events");
    act(() => {
      es.emit("unread", "3");
      es.emit("reports", "2");
    });
    expect(container.textContent).toBe("벨:3신고:2");
    rerender(<Counter name="unread" label="벨" />);
    expect(es.closed).toBe(false);
    unmount();
    expect(es.closed).toBe(true);
  });
});
