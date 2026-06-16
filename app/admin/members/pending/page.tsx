import { countUsersByStatus, listUsersByStatus } from "@/lib/users";
import { approveUserAction } from "@/app/admin/actions";
import { RejectUserButton } from "@/app/admin/reject-user-button";
import MemberTabs from "@/app/admin/member-tabs";

export const metadata = { title: "가입 대기 · 관리자" };

export default async function PendingMembersPage() {
  const [pending, memberCount] = await Promise.all([
    listUsersByStatus("pending"),
    countUsersByStatus(["approved", "blocked"]),
  ]);

  return (
    <section>
      <h1 className="mb-6 text-xl font-semibold tracking-tight">회원 관리</h1>
      <MemberTabs
        active="pending"
        pendingCount={pending.length}
        memberCount={memberCount}
      />

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
    </section>
  );
}
