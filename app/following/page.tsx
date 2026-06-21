import Link from "next/link";
import { getMemberSession } from "@/lib/dal";
import { getFollowingFeed } from "@/lib/follows";
import { toFeedCard } from "@/app/feed/(list)/feed-card";
import FeedCardItem from "@/app/feed/(list)/feed-card-item";
import MemberGate from "@/app/member-gate";

export const metadata = { title: "팔로잉" };
export const dynamic = "force-dynamic";

export default async function FollowingPage() {
  const session = await getMemberSession();
  if (!session) {
    return (
      <MemberGate
        title="회원만 볼 수 있는 피드입니다"
        backHref="/community"
        backLabel="커뮤니티"
      />
    );
  }

  const { items } = await getFollowingFeed(session.userId, "member", 0, 20);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">팔로잉</h1>
      {items.length === 0 ? (
        <p className="text-zinc-500">
          아직 팔로우한 회원의 글이 없습니다.{" "}
          <Link href="/community" className="underline">
            커뮤니티에서 둘러보세요
          </Link>
          .
        </p>
      ) : (
        <ul className="flex flex-col gap-6">
          {items.map((f) => (
            <FeedCardItem key={f.slug} card={toFeedCard(f)} linkAuthors />
          ))}
        </ul>
      )}
    </main>
  );
}
