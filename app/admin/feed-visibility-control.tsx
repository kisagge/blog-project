"use client";
import { useState } from "react";
import VisibilityControl from "@/app/admin/visibility-control";
import { setFeedVisibility } from "@/app/admin/actions";
import type { Visibility } from "@/lib/visibility";

export default function FeedVisibilityControl({
  id,
  value,
}: {
  id: string;
  value: Visibility;
}) {
  const [v, setV] = useState(value);
  return (
    <VisibilityControl
      value={v}
      onSelect={(next) => {
        setV(next);
        void setFeedVisibility(id, next);
      }}
    />
  );
}
