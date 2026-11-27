import Link from "next/link";
import { INPUT_CLASS } from "@/lib/ui";
import { countUsersByStatus, listUsersPage } from "@/lib/users";
import {
  BlockUserButton,
  WithdrawMemberButton,
} from "@/app/admin/block-user-button";
import MemberTabs from "@/app/admin/member-tabs";
import Pager, { parsePage } from "@/app/ui/pager";

export const metadata = { title: "회원 · 관리자" };

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const q = (sp.q ?? "").trim();
  const [members, memberCount, pendingCount] = await Promise.all([
    listUsersPage(["approved", "blocked"], page, undefined, q),
    countUsersByStatus(["approved", "blocked"]),
    countUsersByStatus("pending"),
  ]);

  return (
    <section>
      <h1 className="mb-6 text-xl font-semibold tracking-tight">회원 관리</h1>
      <MemberTabs
        active="members"
        pendingCount={pendingCount}
        memberCount={memberCount}
      />

      {/* 닉네임·이메일 검색(GET — 주소에 남아 페이지 이동에도 유지) */}
      <form
        role="search"
        action="/admin/members"
        className="mb-4 flex items-center gap-2 text-sm"
      >
        <label htmlFor="member-q" className="sr-only">
          회원 검색
        </label>
        <input
          id="member-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="닉네임·이메일"
          className={`${INPUT_CLASS} min-w-0 flex-1 py-1.5`}
        />
        <button
          type="submit"
          className="rounded border border-black/15 px-3 py-1.5 dark:border-white/20"
        >
          검색
        </button>
        {q && (
          <Link href="/admin/members" className="text-zinc-500 hover:underline">
            초기화
          </Link>
        )}
      </form>

      {members.items.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {q ? `‘${q}’에 해당하는 회원이 없습니다.` : "승인된 회원이 없습니다."}
        </p>
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
              <span className="flex shrink-0 gap-2">
                {u.status === "blocked" && (
                  <WithdrawMemberButton
                    id={u.id}
                    label={`${u.nickname} · ${u.email}`}
                  />
                )}
                <BlockUserButton
                  id={u.id}
                  blocked={u.status === "blocked"}
                  label={`${u.nickname} · ${u.email}`}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
      <Pager
        page={page}
        total={members.total}
        pageSize={members.pageSize}
        basePath="/admin/members"
        query={q ? `q=${encodeURIComponent(q)}` : ""}
      />
    </section>
  );
}
