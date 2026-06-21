"use server";
import { revalidatePath } from "next/cache";
import { getMemberSession } from "@/lib/dal";
import { followUser, unfollowUser } from "@/lib/follows";
import { allowAction, TOO_MANY_REQUESTS } from "@/lib/rate-limit";

export type FollowActionResult = { following: boolean } | { error: string };

export async function followAction(
  targetId: string,
): Promise<FollowActionResult> {
  const session = await getMemberSession();
  if (!session) return { error: "로그인이 필요합니다." };
  if (!allowAction("follow", session.userId))
    return { error: TOO_MANY_REQUESTS };
  const res = await followUser(session.userId, targetId);
  if ("error" in res) return { error: res.error };
  revalidatePath(`/u/${targetId}`);
  revalidatePath("/following");
  return { following: true };
}

export async function unfollowAction(
  targetId: string,
): Promise<FollowActionResult> {
  const session = await getMemberSession();
  if (!session) return { error: "로그인이 필요합니다." };
  if (!allowAction("follow", session.userId))
    return { error: TOO_MANY_REQUESTS };
  await unfollowUser(session.userId, targetId);
  revalidatePath(`/u/${targetId}`);
  revalidatePath("/following");
  return { following: false };
}
