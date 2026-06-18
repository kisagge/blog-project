import Link from "next/link";
import { redirect } from "next/navigation";
import {
  listNotifications,
  notificationRecipientId,
} from "@/lib/notifications";
import { kstDateTime, isoInstant } from "@/lib/kst";
import MarkRead from "./mark-read";

export const metadata = { title: "알림" };

export default async function NotificationsPage() {
  const recipientId = await notificationRecipientId();
  if (!recipientId) redirect("/signin");
  const items = await listNotifications(recipientId);

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
          <span
            className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle"
            aria-label="안읽음"
          />
        )}
        {body}
      </span>
      <time dateTime={isoInstant(createdAt)} className="text-xs text-zinc-400">
        {kstDateTime(createdAt)}
      </time>
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
