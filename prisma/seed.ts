import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../app/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.feed.deleteMany();
  await prisma.feed.createMany({
    data: [
      {
        slug: "hello-world",
        title: "첫 글: BY Playground 시작",
        summary: "블로그를 시작하며 남기는 첫 메모.",
        content:
          "# 안녕하세요\n\n**BY Playground**에 오신 걸 환영합니다.\n\n- 마크다운 지원\n- `remark-gfm`으로 표/체크박스도 OK\n\n| 항목 | 값 |\n| --- | --- |\n| 단계 | 2 |",
        published: true,
      },
      {
        slug: "second-post",
        title: "두 번째 글",
        summary: "목록 정렬 확인용 글.",
        content: "두 번째 글의 본문입니다.\n\n줄바꿈도 확인합니다.",
        published: true,
      },
      {
        slug: "draft-hidden",
        title: "비공개 초안 (목록에 안 보여야 함)",
        summary: null,
        content: "이 글은 published=false라 공개 페이지에 노출되면 안 된다.",
        published: false,
      },
    ],
  });
  const count = await prisma.feed.count();
  console.log(`seeded. total=${count}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
