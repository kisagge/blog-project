import { getPublicEnabled } from "@/lib/site-config";
import { setSitePublic } from "@/app/admin/actions";

export const metadata = { title: "설정 · 관리자" };

export default async function AdminSettingsPage() {
  const publicEnabled = await getPublicEnabled();

  return (
    <section>
      <h1 className="mb-6 text-xl font-semibold tracking-tight">설정</h1>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-black/[.08] p-4 dark:border-white/[.145]">
        <div className="min-w-0">
          <p className="font-medium">사이트 공개 상태</p>
          <p className="mt-0.5 text-sm text-zinc-500">
            {publicEnabled
              ? "공개 중 — 누구나 홈·피드를 볼 수 있습니다."
              : "점검 중 — 비로그인 방문자는 점검 안내만 보이고, 관리자만 이용할 수 있습니다."}
          </p>
        </div>
        <form action={setSitePublic} className="shrink-0">
          <input
            type="hidden"
            name="enabled"
            value={publicEnabled ? "false" : "true"}
          />
          <button
            type="submit"
            className={
              publicEnabled
                ? "rounded border border-red-300 px-3 py-1.5 text-sm text-red-600"
                : "bg-foreground text-background rounded px-3 py-1.5 text-sm font-medium"
            }
          >
            {publicEnabled ? "점검 모드로 전환" : "사이트 공개로 전환"}
          </button>
        </form>
      </div>
    </section>
  );
}
