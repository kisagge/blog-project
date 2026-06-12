"use server";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { searchCharacter, type DfCharacterRow } from "@/lib/neople";
import {
  addFeatured,
  removeFeatured,
  reorderFeatured,
} from "@/lib/df-characters";

export type DfSearchState =
  | { rows?: DfCharacterRow[]; error?: string }
  | undefined;

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
  revalidatePath("/admin/df");
  revalidatePath("/df");
}

export async function removeDfCharacterAction(formData: FormData) {
  await verifySession();
  await removeFeatured(String(formData.get("id") ?? ""));
  revalidatePath("/admin/df");
  revalidatePath("/df");
}

export async function reorderDfCharactersAction(orderedIds: string[]) {
  await verifySession();
  await reorderFeatured(orderedIds);
  revalidatePath("/admin/df");
  revalidatePath("/df");
}
