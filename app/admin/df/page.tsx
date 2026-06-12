import { getServers } from "@/lib/neople";
import { listFeatured } from "@/lib/df-characters";
import DfManager from "./df-manager";
import DfCharacterList from "./df-character-list";

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

      <h2 className="mt-8 mb-1 text-lg font-semibold tracking-tight">
        등록된 캐릭터 ({featured.length})
      </h2>
      <p className="mb-3 text-xs text-zinc-500">
        드래그(⠿)해서 노출 순서를 바꿀 수 있습니다.
      </p>
      <DfCharacterList
        key={[...featured]
          .map((c) => c.id)
          .sort()
          .join(",")}
        initial={featured.map((c) => ({
          id: c.id,
          serverId: c.serverId,
          characterName: c.characterName,
        }))}
      />
    </section>
  );
}
