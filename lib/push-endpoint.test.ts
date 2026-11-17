import { describe, expect, test } from "vitest";
import { isAllowedPushEndpoint } from "@/lib/push-endpoint";

describe("isAllowedPushEndpoint", () => {
  test.each([
    "https://fcm.googleapis.com/fcm/send/abc:def",
    "https://updates.push.services.mozilla.com/wpush/v2/gAAA",
    "https://web.push.apple.com/QGuQyavXutnMH",
    "https://wns2-par02p.notify.windows.com/w/?token=BQYAAA",
    "https://android.googleapis.com/gcm/send/abc",
  ])("브라우저 푸시 서비스 허용: %s", (ep) => {
    expect(isAllowedPushEndpoint(ep)).toBe(true);
  });

  test.each([
    "http://fcm.googleapis.com/fcm/send/a", // https 아님
    "https://fcm.googleapis.com:8443/fcm/send/a", // 포트 지정
    "https://127.0.0.1/x", // 내부 주소
    "https://localhost:3010/api/x",
    "https://169.254.169.254/latest/meta-data", // 클라우드 메타데이터
    "https://evil.com/fcm.googleapis.com",
    "https://fcm.googleapis.com.evil.com/x", // 접미사 위장
    "https://evilfcm.googleapis.com.attacker.io/x",
    "https://user:pw@fcm.googleapis.com/x", // 자격증명 포함
    "not a url",
    "",
  ])("그 외 거부: %s", (ep) => {
    expect(isAllowedPushEndpoint(ep)).toBe(false);
  });
});
