// 목록 페이지 나눔 공용(순수). 관리자 표는 번호 페이지, 공개 목록은 "더 보기"(take+1로 다음 존재 판정).

// 관리자 목록(글·회원) 기본 페이지 크기.
export const ADMIN_PAGE_SIZE = 20;

// 1부터 시작하는 페이지 번호 → Prisma skip/take(1 미만·NaN은 1페이지로).
export function pageWindow(page: number, size: number) {
  return { skip: (Math.max(1, page) - 1) * size, take: size };
}

// take+1개를 받아 둔 행에서 다음 페이지 존재 여부를 판정(추가 count 쿼리 없이).
export function sliceHasMore<T>(rows: T[], take: number) {
  const hasMore = rows.length > take;
  return { items: hasMore ? rows.slice(0, take) : rows, hasMore };
}
