import "server-only";
import { prisma } from "@/lib/prisma";
import { listableVisibilities, type ViewerRole } from "@/lib/visibility";

// 관리자용: 전체(공개 범위 무관).
export async function listFeatured() {
  return prisma.dfCharacter.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

// 공개 목록용: 뷰어 권한으로 볼 수 있는 캐릭터(비공개 제외).
export async function listFeaturedVisible(role: ViewerRole) {
  return prisma.dfCharacter.findMany({
    where: { visibility: { in: listableVisibilities(role) } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function setFeaturedVisibility(
  id: string,
  visibility: "public" | "members" | "private",
) {
  await prisma.dfCharacter.update({ where: { id }, data: { visibility } });
}

// 등록된 캐릭터 단건(조회수 트래킹·표시용). 미등록이면 null.
export async function getFeaturedByCharacter(
  serverId: string,
  characterId: string,
) {
  return prisma.dfCharacter.findUnique({
    where: { serverId_characterId: { serverId, characterId } },
  });
}

// 등록(이미 있으면 이름만 갱신). serverId+characterId 유니크. 신규는 맨 뒤에 배치.
export async function addFeatured(input: {
  serverId: string;
  characterId: string;
  characterName: string;
}) {
  const max = await prisma.dfCharacter.aggregate({ _max: { sortOrder: true } });
  return prisma.dfCharacter.upsert({
    where: {
      serverId_characterId: {
        serverId: input.serverId,
        characterId: input.characterId,
      },
    },
    update: { characterName: input.characterName },
    create: { ...input, sortOrder: (max._max.sortOrder ?? -1) + 1 },
  });
}

export async function removeFeatured(id: string) {
  await prisma.dfCharacter.delete({ where: { id } });
}

// 주어진 순서(id 배열)대로 sortOrder를 0,1,2…로 갱신.
export async function reorderFeatured(orderedIds: string[]) {
  await prisma.$transaction(
    orderedIds.map((id, i) =>
      prisma.dfCharacter.update({ where: { id }, data: { sortOrder: i } }),
    ),
  );
}
