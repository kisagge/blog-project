import { redirect } from "next/navigation";
import { getSession } from "@/lib/dal";
import { listSavedFeeds } from "@/lib/bookmarks";
import { toFeedCard } from "@/app/feed/(list)/feed-card";
import AccountTabs from "../account-tabs";
import SavedFeedList from "./saved-feed-list";

export const metadata = { title: "저장한 글" };

export default async function SavedPage() {
  const session = await getSession();
  if (session?.role !== "member") redirect("/signin");
  const { items, hasMore } = await listSavedFeeds(session.userId);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">내 계정</h1>
      <AccountTabs active="saved" />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">저장한 글</h2>
        <SavedFeedList
          initialItems={items.map(toFeedCard)}
          initialHasMore={hasMore}
        />
      </section>
    </main>
  );
}
