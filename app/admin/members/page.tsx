import { listUsersByStatus, listUsersPage } from "@/lib/users";
import {
  approveUserAction,
  blockUserAction,
  unblockUserAction,
} from "@/app/admin/actions";
import { RejectUserButton } from "@/app/admin/reject-user-button";
import Pager, { parsePage } from "@/app/admin/pager";

export const metadata = { title: "회원 관리 · 관리자" };

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = parsePage((await searchParams).page);
  const [pending, members] = await Promise.all([
    listUsersByStatus("pending"),
    listUsersPage(["approved", "blocked"], page),
  ]);

  return (
    <section>
      <h1 className="mb-6 text-xl font-semibold tracking-tight">회원 관리</h1>

      <h2 className="mb-3 text-lg font-semibold tracking-tight">
        가입 대기 ({pending.length})
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
              <span className="flex min-w-0 flex-col">
                <span className="truncate">
                  {u.nickname} · {u.email}
                </span>
                {u.rejectionReason && (
                  <span className="mt-0.5 truncate text-xs text-amber-600 dark:text-amber-500">
                    재신청 · 이전 거절 사유: {u.rejectionReason}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 gap-2">
                <form action={approveUserAction}>
                  <input type="hidden" name="id" value={u.id} />
                  <button className="rounded border border-black/15 px-2 py-1 dark:border-white/20">
                    승인
                  </button>
                </form>
                <RejectUserButton
                  id={u.id}
                  label={`${u.nickname} · ${u.email}`}
                />
              </span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 mb-3 text-lg font-semibold tracking-tight">
        회원 ({members.total})
      </h2>
      {members.items.length === 0 ? (
        <p className="text-sm text-zinc-500">승인된 회원이 없습니다.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.1]">
          {members.items.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2 truncate">
                <span className="truncate">
                  {u.nickname} · {u.email}
                </span>
                {u.status === "blocked" && (
                  <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                    차단됨
                  </span>
                )}
              </span>
              {u.status === "blocked" ? (
                <form action={unblockUserAction}>
                  <input type="hidden" name="id" value={u.id} />
                  <button className="rounded border border-black/15 px-2 py-1 dark:border-white/20">
                    차단 해제
                  </button>
                </form>
              ) : (
                <form action={blockUserAction}>
                  <input type="hidden" name="id" value={u.id} />
                  <button className="rounded border border-red-300 px-2 py-1 text-red-600">
                    차단
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      <Pager
        page={page}
        total={members.total}
        pageSize={members.pageSize}
        basePath="/admin/members"
      />
    </section>
  );
}
