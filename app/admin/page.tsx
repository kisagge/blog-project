import Link from "next/link";
import { countFeeds } from "@/lib/feeds";
import { getPublicEnabled } from "@/lib/site-config";
import { countUsersByStatus } from "@/lib/users";
import { listFeatured } from "@/lib/df-characters";

export const metadata = { title: "관리자 · BY Playground" };

export default async function AdminDashboardPage() {
  const [feeds, publicEnabled, pendingCount, memberCount, dfCharacters] =
    await Promise.all([
      countFeeds(),
      getPublicEnabled(),
      countUsersByStatus("pending"),
      countUsersByStatus("approved"),
      listFeatured(),
    ]);

  return (
    <section>
      <h1 className="mb-6 text-xl font-semibold tracking-tight">대시보드</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card
          href="/admin/feeds"
          label="글"
          value={`${feeds.total}`}
          sub={`공개 ${feeds.published} · 비공개 ${feeds.draft}`}
        />
        <Card
          href="/admin/members"
          label="가입 대기"
          value={`${pendingCount}`}
          sub={pendingCount > 0 ? "승인 필요" : "없음"}
          highlight={pendingCount > 0}
        />
        <Card
          href="/admin/members"
          label="회원"
          value={`${memberCount}`}
          sub="승인됨"
        />
        <Card
          href="/admin/df"
          label="던파 캐릭터"
          value={`${dfCharacters.length}`}
          sub="쇼케이스"
        />
        <Card
          href="/admin/settings"
          label="사이트"
          value={publicEnabled ? "공개" : "점검"}
          sub={publicEnabled ? "누구나 열람" : "관리자만"}
          highlight={!publicEnabled}
        />
      </div>
    </section>
  );
}

function Card({
  href,
  label,
  value,
  sub,
  highlight,
}: {
  href: string;
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col gap-1 rounded-lg border p-4 transition-colors hover:bg-black/[.02] dark:hover:bg-white/[.03] ${
        highlight
          ? "border-red-300 dark:border-red-400/40"
          : "border-black/[.08] dark:border-white/[.145]"
      }`}
    >
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-2xl font-semibold tracking-tight">{value}</span>
      <span className="text-xs text-zinc-500">{sub}</span>
    </Link>
  );
}
