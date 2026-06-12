import { redirect } from "next/navigation";
import { getSession } from "@/lib/dal";

// 던파 쇼케이스는 로그인 회원(및 관리자) 전용.
export default async function DfLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (session?.role !== "member" && session?.role !== "admin")
    redirect("/signin");
  return children;
}
