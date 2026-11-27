import Link from "next/link";
import { redirect } from "next/navigation";
import {
  listNotificationsPage,
  notificationRecipientId,
} from "@/lib/notifications";
import Pager, { parsePage } from "@/app/ui/pager";
import MarkRead from "./mark-read";
import KstTime from "@/app/ui/kst-time";

export const metadata = { title: "알림" };

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const recipientId = await notificationRecipientId();
  if (!recipientId) redirect("/signin");
  const page = parsePage((await searchParams).page);
  const { items, total, pageSize } = await listNotificationsPage(
    recipientId,
    page,
  );
  // 범위를 넘은 페이지(알림이 정리돼 줄어든 경우 등)는 첫 페이지로.
  if (items.length === 0 && page > 1) redirect("/notifications");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <MarkRead />
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">알림</h1>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">알림이 없습니다.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.1]">
          {items.map((n) => (
            <li key={n.id} className="py-3">
              <Item
                body={n.body}
                url={n.url}
                createdAt={n.createdAt.toISOString()}
                unread={n.readAt === null}
              />
            </li>
          ))}
        </ul>
      )}
      <Pager
        page={page}
        total={total}
        pageSize={pageSize}
        basePath="/notifications"
        label="알림 페이지"
      />
    </main>
  );
}

function Item({
  body,
  url,
  createdAt,
  unread,
}: {
  body: string;
  url: string | null;
  createdAt: string;
  unread: boolean;
}) {
  const content = (
    <span className="flex flex-col gap-0.5">
      <span className="text-sm">
        {unread && (
          <>
            {/* 점은 장식, 상태는 화면 낭독기용 텍스트로(일반 span에는 aria-label을 쓸 수 없음). */}
            <span
              aria-hidden
              className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle"
            />
            <span className="sr-only">안읽음: </span>
          </>
        )}
        {body}
      </span>
      <KstTime value={createdAt} withTime className="text-xs text-zinc-500" />
    </span>
  );
  return url ? (
    <Link href={url} className="block hover:underline">
      {content}
    </Link>
  ) : (
    content
  );
}
