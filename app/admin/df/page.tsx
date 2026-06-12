import { getServers } from "@/lib/neople";
import { listFeatured } from "@/lib/df-characters";
import { removeDfCharacterAction } from "./actions";
import DfManager from "./df-manager";

export const metadata = { title: "던파 캐릭터 · 관리자" };

export default async function AdminDfPage() {
  const [servers, featured] = await Promise.all([
    getServers().catch(() => []),
    listFeatured(),
  ]);

  return (
    <section>
      <h1 className="mb-6 text-xl font-semibold tracking-tight">던파 캐릭터</h1>

      <h2 className="mb-3 text-lg font-semibold tracking-tight">캐릭터 검색</h2>
      <DfManager servers={servers} />

      <h2 className="mt-8 mb-3 text-lg font-semibold tracking-tight">
        등록된 캐릭터 ({featured.length})
      </h2>
      {featured.length === 0 ? (
        <p className="text-sm text-zinc-500">등록된 캐릭터가 없습니다.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.1]">
          {featured.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">
                {c.characterName} · {c.serverId}
              </span>
              <form action={removeDfCharacterAction}>
                <input type="hidden" name="id" value={c.id} />
                <button className="shrink-0 rounded border border-red-300 px-2 py-1 text-red-600">
                  삭제
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
