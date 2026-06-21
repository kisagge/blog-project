"use client";
import { useState, useTransition } from "react";
import { followAction, unfollowAction } from "./follow-actions";

export default function FollowButton({
  targetId,
  initialFollowing,
}: {
  targetId: string;
  initialFollowing: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !following;
    setFollowing(next); // 낙관적 토글
    startTransition(async () => {
      const res = next
        ? await followAction(targetId)
        : await unfollowAction(targetId);
      if ("error" in res)
        setFollowing(!next); // 실패 롤백
      else setFollowing(res.following);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={following}
      className={
        following
          ? "rounded-full border border-black/15 px-4 py-1.5 text-sm font-medium disabled:opacity-50 dark:border-white/20"
          : "bg-foreground text-background rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-50"
      }
    >
      {following ? "팔로잉" : "팔로우"}
    </button>
  );
}
