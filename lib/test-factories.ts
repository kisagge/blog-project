// 테스트용 엔티티 팩토리. 반복되는 User/Feed/Comment 생성 보일러플레이트를 줄인다.
// 필수 필드는 기본값으로 채우고, overrides로 필요한 값만 덮어쓴다.
import type { Prisma } from "@/app/generated/prisma/client";

type Db = (typeof import("@/lib/prisma"))["prisma"];

let seq = 0;
const next = () => ++seq;

export async function makeUser(
  prisma: Db,
  overrides: Partial<Prisma.UserUncheckedCreateInput> = {},
) {
  const n = next();
  return prisma.user.create({
    data: {
      email: `user${n}@test.local`,
      nickname: `유저${n}`,
      passwordHash: "-",
      status: "approved",
      ...overrides,
    },
  });
}

export async function makeFeed(
  prisma: Db,
  overrides: Partial<Prisma.FeedUncheckedCreateInput> = {},
) {
  const n = next();
  return prisma.feed.create({
    data: {
      slug: `feed-${n}`,
      title: `글${n}`,
      content: "본문",
      visibility: "public",
      ...overrides,
    },
  });
}

export async function makeComment(
  prisma: Db,
  feedId: string,
  userId: string,
  overrides: Partial<Prisma.CommentUncheckedCreateInput> = {},
) {
  return prisma.comment.create({
    data: { feedId, userId, content: "댓글", ...overrides },
  });
}
