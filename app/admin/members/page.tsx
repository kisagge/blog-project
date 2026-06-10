import { listUsersByStatus } from "@/lib/users";
import { approveUserAction, removeUserAction } from "@/app/admin/actions";

export const metadata = { title: "회원 관리 · 관리자" };

export default async function AdminMembersPage() {
  const [pending, members] = await Promise.all([
    listUsersByStatus("pending"),
    listUsersByStatus("approved"),
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

      <h2 className="mt-8 mb-3 text-lg font-semibold tracking-tight">
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
  );
}
