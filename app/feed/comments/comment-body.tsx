"use client";
import { useEffect, useRef, useState } from "react";

// @멘션 토큰을 색으로 강조(장식 — 닉네임 유일성 문제로 링크는 걸지 않음).
function renderMentions(content: string) {
  return content.split(/(@[^\s]+)/g).map((part, i) =>
    part.startsWith("@") && part.length > 1 ? (
      <span key={i} className="font-medium text-blue-600 dark:text-blue-400">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

export default function CommentBody({ content }: { content: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el) setOverflow(el.scrollHeight - el.clientHeight > 1);
  }, [content]);

  return (
    <div>
      <p
        ref={ref}
        className={`text-sm break-words whitespace-pre-wrap ${expanded ? "" : "line-clamp-3"}`}
      >
        {renderMentions(content)}
      </p>
      {(overflow || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          {expanded ? "접기" : "더보기"}
        </button>
      )}
    </div>
  );
}
