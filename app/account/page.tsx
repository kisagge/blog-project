import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import AccountForm from "./account-form";
import AccountTabs from "./account-tabs";

export const metadata = { title: "내 정보" };

export default async function AccountPage() {
  const session = await getSession();
  if (session?.role !== "member") redirect("/signin");
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true, nickname: true, bio: true, avatarUrl: true },
  });
  if (!user) redirect("/signin");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">내 계정</h1>
      <AccountTabs active="info" />
      <AccountForm
        email={user.email}
        nickname={user.nickname}
        bio={user.bio ?? ""}
        avatarUrl={user.avatarUrl ?? ""}
      />
      <p className="border-t border-black/[.08] pt-6 text-right text-sm dark:border-white/[.145]">
        <Link
          href="/account/withdraw"
          className="text-zinc-500 hover:text-red-600 hover:underline dark:hover:text-red-400"
        >
          회원 탈퇴
        </Link>
      </p>
    </main>
  );
}
