import { countUsersByStatus, listUsersPage } from "@/lib/users";
import { BlockUserButton } from "@/app/admin/block-user-button";
import MemberTabs from "@/app/admin/member-tabs";
import Pager, { parsePage } from "@/app/admin/pager";

export const metadata = { title: "회원 · 관리자" };

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = parsePage((await searchParams).page);
  const [members, pendingCount] = await Promise.all([
    listUsersPage(["approved", "blocked"], page),
    countUsersByStatus("pending"),
  ]);

  return (
    <section>
      <h1 className="mb-6 text-xl font-semibold tracking-tight">회원 관리</h1>
      <MemberTabs
        active="members"
        pendingCount={pendingCount}
        memberCount={members.total}
      />

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
              <BlockUserButton
                id={u.id}
                blocked={u.status === "blocked"}
                label={`${u.nickname} · ${u.email}`}
              />
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
