"use server";
import { LOGIN_REQUIRED } from "@/lib/form-state";
import { revalidatePath } from "next/cache";
import { getMemberSession } from "@/lib/dal";
import { followUser, unfollowUser } from "@/lib/follows";
import { allowAction, TOO_MANY_REQUESTS } from "@/lib/rate-limit";

type FollowActionResult = { following: boolean } | { error: string };

// 팔로우/언팔로우 공용 앞단: 회원 확인 + 토글 난타 방지. 통과면 userId, 아니면 에러.
async function followGuard(): Promise<{ userId: string } | { error: string }> {
  const session = await getMemberSession();
  if (!session) return { error: LOGIN_REQUIRED };
  if (!allowAction("follow", session.userId))
    return { error: TOO_MANY_REQUESTS };
  return { userId: session.userId };
}

// 대상 프로필(팔로워 수·버튼) + 내 팔로잉 피드.
function revalidateFollow(targetId: string) {
  revalidatePath(`/u/${targetId}`);
  revalidatePath("/following");
}

export async function followAction(
  targetId: string,
): Promise<FollowActionResult> {
  const g = await followGuard();
  if ("error" in g) return g;
  const res = await followUser(g.userId, targetId);
  if (!res.ok) return { error: res.error };
  revalidateFollow(targetId);
  return { following: true };
}

export async function unfollowAction(
  targetId: string,
): Promise<FollowActionResult> {
  const g = await followGuard();
  if ("error" in g) return g;
  await unfollowUser(g.userId, targetId);
  revalidateFollow(targetId);
  return { following: false };
}
