import { notificationRecipientId, countUnread } from "@/lib/notifications";
import { getSession } from "@/lib/dal";
import { subscribeUnread, subscribeReports } from "@/lib/events";
import { countPendingReportTargets } from "@/lib/reports";
import { sseEvent, sseResponse } from "@/lib/sse";
import { clientIpKey } from "@/lib/form-guard";

// SSE: 로그인 회원/관리자에게 알림 미읽음 수(+관리자는 미처리 신고 수)를 실시간 전달.
// 단일 컨테이너 인메모리 버스.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = await notificationRecipientId();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  // 초기값은 스트림 생성 전에 조회(sseResponse의 setup은 동기).
  const isAdmin = (await getSession())?.role === "admin";
  const initialUnread = await countUnread(userId);
  const initialReports = isAdmin ? await countPendingReportTargets() : 0;

  return sseResponse(
    req.signal,
    (send) => {
      send(sseEvent(initialUnread, "unread"));
      const unsubs = [
        subscribeUnread(userId, (n) => send(sseEvent(n, "unread"))),
      ];
      // 관리자는 미처리 신고 수도 구독(같은 연결에 이벤트 종류만 추가).
      if (isAdmin) {
        send(sseEvent(initialReports, "reports"));
        unsubs.push(subscribeReports((c) => send(sseEvent(c, "reports"))));
      }
      return unsubs;
    },
    { key: await clientIpKey() },
  );
}
