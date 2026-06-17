import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/dal";
import { getNotificationPrefs } from "@/lib/notifications";
import NotificationPrefsForm from "./notification-prefs-form";

export const metadata = { title: "알림 설정" };

export default async function NotificationsPage() {
  const session = await getSession();
  if (session?.role !== "member") redirect("/signin");
  const prefs = await getNotificationPrefs(session.userId);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <Link
        href="/notifications"
        className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        ← 알림
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">알림 설정</h1>
        <p className="mt-1 text-sm text-zinc-500">
          받고 싶은 알림 종류를 선택하세요. 끄면 인앱·푸시 모두 받지 않습니다.
        </p>
      </div>
      <NotificationPrefsForm prefs={prefs} />
    </main>
  );
}
