"use client";
import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  removeDfCharacterAction,
  reorderDfCharactersAction,
  cycleDfVisibilityAction,
} from "./actions";
import { serverName } from "@/lib/df-servers";
import { VISIBILITY_LABELS, type Visibility } from "@/lib/visibility";

type Item = {
  id: string;
  serverId: string;
  characterName: string;
  visibility: Visibility;
};

const NEXT_VIS: Record<Visibility, Visibility> = {
  public: "members",
  members: "private",
  private: "public",
};

export default function DfCharacterList({ initial }: { initial: Item[] }) {
  const [items, setItems] = useState(initial);
  // 포인터(마우스+터치) 8px 이동 후 드래그 시작 → 탭/스크롤과 충돌 없음.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  if (items.length === 0)
    return <p className="text-sm text-zinc-500">등록된 캐릭터가 없습니다.</p>;

  // 공개 범위 순환(낙관적 갱신 + 서버 저장).
  function cycleVisibility(id: string) {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, visibility: NEXT_VIS[i.visibility] } : i,
      ),
    );
    void cycleDfVisibilityAction(id);
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const from = prev.findIndex((i) => i.id === active.id);
      const to = prev.findIndex((i) => i.id === over.id);
      if (from < 0 || to < 0) return prev;
      const next = arrayMove(prev, from, to);
      void reorderDfCharactersAction(next.map((i) => i.id));
      return next;
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.1]">
          {items.map((c) => (
            <Row key={c.id} item={c} onCycle={cycleVisibility} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function Row({ item, onCycle }: { item: Item; onCycle: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="bg-background flex items-center justify-between gap-3 py-2 text-sm"
    >
      <span className="flex min-w-0 items-center gap-2">
        {/* 드래그 핸들에만 리스너 + touch-none → 목록 다른 곳은 정상 스크롤 */}
        <button
          type="button"
          aria-label="드래그하여 순서 변경"
          className="cursor-grab touch-none text-zinc-400 select-none active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <span className="truncate">
          {item.characterName} · {serverName(item.serverId)}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => onCycle(item.id)}
          title="공개 범위 변경(전체→회원→비공개)"
          className="rounded border border-black/15 px-2 py-1 text-xs dark:border-white/20"
        >
          {VISIBILITY_LABELS[item.visibility]}
        </button>
        <form action={removeDfCharacterAction}>
          <input type="hidden" name="id" value={item.id} />
          <button className="rounded border border-red-300 px-2 py-1 text-red-600">
            삭제
          </button>
        </form>
      </span>
    </li>
  );
}
