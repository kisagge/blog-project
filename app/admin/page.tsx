import Link from "next/link";
import { getAllFeeds } from "@/lib/feeds";
import { getPublicEnabled } from "@/lib/site-config";
import { listUsersByStatus } from "@/lib/users";
import {
  approveUserAction,
  removeUserAction,
  setSitePublic,
  togglePublished,
} from "@/app/admin/actions";
import { DeleteFeedButton } from "@/app/admin/delete-feed-button";

export default async function AdminListPage() {
  const [feeds, publicEnabled, pending, members] = await Promise.all([
    getAllFeeds(),
    getPublicEnabled(),
    listUsersByStatus("pending"),
    listUsersByStatus("approved"),
  ]);

  return (
    <section>
      <div className="mb-8 flex items-center justify-between gap-3 rounded-lg border border-black/[.08] p-4 dark:border-white/[.145]">
        <div className="min-w-0">
          <p className="font-medium">사이트 공개 상태</p>
          <p className="mt-0.5 text-sm text-zinc-500">
            {publicEnabled
              ? "공개 중 — 누구나 홈·피드를 볼 수 있습니다."
              : "점검 중 — 비로그인 방문자는 점검 안내만 보이고, 관리자만 이용할 수 있습니다."}
          </p>
        </div>
        <form action={setSitePublic} className="shrink-0">
          <input
            type="hidden"
            name="enabled"
            value={publicEnabled ? "false" : "true"}
          />
          <button
            type="submit"
            className={
              publicEnabled
                ? "rounded border border-red-300 px-3 py-1.5 text-sm text-red-600"
                : "bg-foreground text-background rounded px-3 py-1.5 text-sm font-medium"
            }
          >
            {publicEnabled ? "점검 모드로 전환" : "사이트 공개로 전환"}
          </button>
        </form>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          가입 대기 회원 ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-zinc-500">대기 중인 신청이 없습니다.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.1]">
            {pending.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">
                  {u.nickname} · {u.email}
                </span>
                <span className="flex shrink-0 gap-2">
                  <form action={approveUserAction}>
                    <input type="hidden" name="id" value={u.id} />
                    <button className="rounded border border-black/15 px-2 py-1 dark:border-white/20">
                      승인
                    </button>
                  </form>
                  <form action={removeUserAction}>
                    <input type="hidden" name="id" value={u.id} />
                    <button className="rounded border border-red-300 px-2 py-1 text-red-600">
                      거절
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}
        <h2 className="mt-6 mb-3 text-lg font-semibold tracking-tight">
          회원 ({members.length})
        </h2>
        {members.length === 0 ? (
          <p className="text-sm text-zinc-500">승인된 회원이 없습니다.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.1]">
            {members.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">
                  {u.nickname} · {u.email}
                </span>
                <form action={removeUserAction}>
                  <input type="hidden" name="id" value={u.id} />
                  <button className="rounded border border-red-300 px-2 py-1 text-red-600">
                    삭제
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <h1 className="mb-6 text-xl font-semibold tracking-tight">글 목록</h1>
      {feeds.length === 0 ? (
        <p className="text-zinc-500">
          글이 없습니다.{" "}
          <Link href="/admin/new" className="underline">
            새 글 작성
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.1]">
          {feeds.map((feed) => (
            <li
              key={feed.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{feed.title}</p>
                <p className="truncate text-sm text-zinc-500">
                  /{feed.slug} · {feed.published ? "공개" : "비공개"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-sm">
                <form action={togglePublished}>
                  <input type="hidden" name="id" value={feed.id} />
                  <button
                    type="submit"
                    className="rounded border border-black/15 px-2 py-1 dark:border-white/20"
                  >
                    {feed.published ? "비공개로" : "공개로"}
                  </button>
                </form>
                <Link
                  href={`/admin/${feed.id}/edit`}
                  className="rounded border border-black/15 px-2 py-1 dark:border-white/20"
                >
                  수정
                </Link>
                <DeleteFeedButton id={feed.id} title={feed.title} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
