"use client";
import { useState } from "react";
import { removeDfCharacterAction, reorderDfCharactersAction } from "./actions";

type Item = { id: string; serverId: string; characterName: string };

export default function DfCharacterList({ initial }: { initial: Item[] }) {
  const [items, setItems] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);

  if (items.length === 0)
    return <p className="text-sm text-zinc-500">등록된 캐릭터가 없습니다.</p>;

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    const from = items.findIndex((i) => i.id === dragId);
    const to = items.findIndex((i) => i.id === targetId);
    setDragId(null);
    if (from < 0 || to < 0) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    void reorderDfCharactersAction(next.map((i) => i.id));
  }

  return (
    <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.1]">
      {items.map((c) => (
        <li
          key={c.id}
          draggable
          onDragStart={() => setDragId(c.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(c.id)}
          onDragEnd={() => setDragId(null)}
          className={`flex items-center justify-between gap-3 py-2 text-sm ${
            dragId === c.id ? "opacity-40" : ""
          }`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="cursor-grab text-zinc-400 select-none">⠿</span>
            <span className="truncate">
              {c.characterName} · {c.serverId}
            </span>
          </span>
          <form action={removeDfCharacterAction}>
            <input type="hidden" name="id" value={c.id} />
            <button className="shrink-0 rounded border border-red-300 px-2 py-1 text-red-600">
              삭제
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
