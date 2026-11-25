import "server-only";
import { prisma } from "@/lib/prisma";
import { deleteUpload } from "@/lib/save-image";
import { emailHash } from "@/lib/blocked-email";
import type { Result } from "@/lib/result";

export const WITHDRAWN_NICKNAME = "탈퇴한 회원";
// 탈퇴 회원 행의 이메일 자리(원래 이메일은 지움). 예약 도메인이라 가입·로그인 불가, id로 유일.
const tombstoneEmail = (id: string) => `withdrawn-${id}@byjang.local`;

// 회원 탈퇴. 정책(docs/tech-spec 회원 탈퇴):
// - 개인정보(이메일·비밀번호·자기소개·아바타·알림 설정)는 지우고 회원 행은 "탈퇴한 회원"으로 남겨,
//   글·댓글·좋아요·반응은 보존(남의 답글·댓글이 함께 사라지지 않게). deletePosts면 내 글은 삭제.
// - 사적인 데이터(임시저장·팔로우 양방향·알림·푸시 구독·저장·재설정 코드)는 삭제.
// - 차단 상태였다면 이메일 해시만 보관해 같은 이메일 재가입을 막는다(일반 탈퇴는 재가입 허용).
// - sessionVersion을 올려 모든 기기 로그인 무효.
export async function withdrawMember(
  userId: string,
  { deletePosts }: { deletePosts: boolean },
): Promise<Result> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, status: true },
  });
  if (!user || user.role !== "member")
    return { ok: false, error: "탈퇴할 수 있는 회원이 아닙니다." };

  // 지울 업로드 파일: 아바타는 항상, 글까지 지우면 본문 이미지도(보존하는 글의 이미지는 남김).
  const uploads = await prisma.upload.findMany({
    where: { ownerId: userId, ...(deletePosts ? {} : { kind: "avatar" }) },
    select: { name: true },
  });

  await prisma.$transaction([
    prisma.feed.deleteMany({
      where: {
        authorId: userId,
        ...(deletePosts ? {} : { status: "draft" }), // 임시저장은 항상 삭제
      },
    }),
    prisma.follow.deleteMany({
      where: { OR: [{ followerId: userId }, { followingId: userId }] },
    }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.pushSubscription.deleteMany({ where: { userId } }),
    prisma.bookmark.deleteMany({ where: { userId } }),
    prisma.passwordResetCode.deleteMany({ where: { email: user.email } }),
    prisma.upload.deleteMany({
      where: { name: { in: uploads.map((u) => u.name) } },
    }),
    ...(user.status === "blocked"
      ? [
          prisma.blockedEmail.upsert({
            where: { emailHash: emailHash(user.email) },
            create: { emailHash: emailHash(user.email) },
            update: {},
          }),
        ]
      : []),
    prisma.user.update({
      where: { id: userId },
      data: {
        email: tombstoneEmail(userId),
        nickname: WITHDRAWN_NICKNAME,
        bio: null,
        avatarUrl: null,
        passwordHash: "-", // salt:hash 형식이 아니라 어떤 비밀번호로도 로그인 불가
        role: "withdrawn",
        status: "withdrawn",
        rejectionReason: null,
        withdrawnAt: new Date(),
        notifyOnReply: false,
        notifyOnComment: false,
        notifyOnMention: false,
        notifyOnFollow: false,
        sessionVersion: { increment: 1 },
      },
    }),
  ]);

  // 파일 삭제는 트랜잭션 밖(best-effort — 실패해도 탈퇴는 완료).
  await Promise.all(uploads.map((u) => deleteUpload(`/uploads/${u.name}`)));
  return { ok: true };
}
