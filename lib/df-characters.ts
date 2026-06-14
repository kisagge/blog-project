import "server-only";
import { prisma } from "@/lib/prisma";

export async function listFeatured() {
  return prisma.dfCharacter.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
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
