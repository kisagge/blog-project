import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/dal";
import { getMyPost } from "@/lib/member-posts";
import PostEditor from "../../post-editor";

export const metadata = { title: "글 수정" };

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (session?.role !== "member") redirect("/signin");
  const { id } = await params;
  const post = await getMyPost(session.userId, id);
  if (!post) notFound();

  const isDraft = post.status === "draft";
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <div>
        <Link href="/account" className="text-sm text-zinc-500 hover:underline">
          ← 내 정보
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {isDraft ? "임시저장 글 수정" : "글 수정"}
        </h1>
        {isDraft && (
          <p className="mt-1 text-sm text-zinc-500">
            게시하면 회원에게 공개되고 임시저장에서 사라집니다.
          </p>
        )}
      </div>
      <PostEditor
        post={{
          id: post.id,
          title: post.title,
          content: post.content,
          status: post.status,
          tags: post.feedTags.map((ft) => ft.tag.name).join(", "),
        }}
      />
    </main>
  );
}
