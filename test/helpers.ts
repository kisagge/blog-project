// 여러 테스트가 같은 모양으로 쓰던 픽스처·헬퍼. (테스트 전용 — 앱 코드에서 import하지 않는다)

// 서버 액션 폼 입력: { name: value } → FormData.
export function formData(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

// 1×1 투명 PNG(매직바이트·치수 검증을 통과하는 최소 이미지).
export const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

// 업로드 입력용 PNG 파일.
export function pngFile(name = "a.png"): File {
  return new File([PNG_1x1], name, { type: "image/png" });
}

// 브라우저 EventSource 대역(SSE 소비 컴포넌트 테스트). 생성된 인스턴스를 모아 두어 테스트가
// onopen/onmessage를 직접 호출해 이벤트를 흉내 낸다. vi.stubGlobal("EventSource", FakeEventSource)로 사용.
export class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  closed = false;
  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  addEventListener() {}
  close() {
    this.closed = true;
  }
}
