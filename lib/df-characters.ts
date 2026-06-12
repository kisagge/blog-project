import "server-only";
import { prisma } from "@/lib/prisma";

export async function listFeatured() {
  return prisma.dfCharacter.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

// 등록(이미 있으면 이름만 갱신). serverId+characterId 유니크.
export async function addFeatured(input: {
  serverId: string;
  characterId: string;
  characterName: string;
}) {
  return prisma.dfCharacter.upsert({
    where: {
      serverId_characterId: {
        serverId: input.serverId,
        characterId: input.characterId,
      },
    },
    update: { characterName: input.characterName },
    create: input,
  });
}

export async function removeFeatured(id: string) {
  await prisma.dfCharacter.delete({ where: { id } });
}
