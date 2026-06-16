import { redirect } from "next/navigation";
import { getMemberSession } from "@/lib/dal";

// 내 공개 프로필로 리다이렉트(클라 드로어에 userId 노출 회피). 차단/비회원은 로그인으로.
export default async function MePage() {
  const session = await getMemberSession();
  if (!session) redirect("/signin");
  redirect(`/u/${session.userId}`);
}
