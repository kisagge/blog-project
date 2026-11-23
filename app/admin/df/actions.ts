"use server";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { searchCharacter, type DfCharacterRow } from "@/lib/neople";
import {
  addFeatured,
  removeFeatured,
  reorderFeatured,
  setFeaturedVisibility,
} from "@/lib/df-characters";
import { isVisibility, type Visibility } from "@/lib/visibility";

// 관리 화면 + 공개 /df(목록·상세는 /df 아래).
function revalidateDf() {
  revalidatePath("/admin/df");
  revalidatePath("/df");
}

export type DfSearchState =
  { rows?: DfCharacterRow[]; error?: string } | undefined;

export async function searchDfCharactersAction(
  _state: DfSearchState,
  formData: FormData,
): Promise<DfSearchState> {
  await verifySession();
  const serverId = String(formData.get("serverId") ?? "").trim();
  const characterName = String(formData.get("characterName") ?? "").trim();
  if (!serverId || !characterName)
    return { error: "서버와 캐릭터명을 입력하세요." };
  try {
    const rows = await searchCharacter(serverId, characterName);
    if (rows.length === 0) return { error: "검색 결과가 없습니다." };
    return { rows };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "검색에 실패했습니다." };
  }
}

export async function addDfCharacterAction(formData: FormData) {
  await verifySession();
  await addFeatured({
    serverId: String(formData.get("serverId") ?? ""),
    characterId: String(formData.get("characterId") ?? ""),
    characterName: String(formData.get("characterName") ?? ""),
  });
  revalidateDf();
}

export async function removeDfCharacterAction(formData: FormData) {
  await verifySession();
  await removeFeatured(String(formData.get("id") ?? ""));
  revalidateDf();
}

export async function reorderDfCharactersAction(orderedIds: string[]) {
  await verifySession();
  await reorderFeatured(orderedIds);
  revalidateDf();
}

export async function setDfVisibilityAction(
  id: string,
  visibility: Visibility,
) {
  await verifySession();
  // 서버 액션 인자는 클라이언트가 임의로 보낼 수 있다 — 허용값 외는 무시.
  if (!isVisibility(visibility)) return;
  await setFeaturedVisibility(id, visibility);
  revalidateDf();
}
