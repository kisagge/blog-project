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
import { reorderSeriesAction, removeFromSeriesAction } from "./actions";

type Item = { id: string; title: string; slug: string; visibility: string };

export default function SeriesPostList({
  seriesId,
  initial,
}: {
  seriesId: string;
  initial: Item[];
}) {
  const [items, setItems] = useState(initial);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const from = prev.findIndex((i) => i.id === active.id);
      const to = prev.findIndex((i) => i.id === over.id);
      if (from < 0 || to < 0) return prev;
      const next = arrayMove(prev, from, to);
      void reorderSeriesAction(
        seriesId,
        next.map((i) => i.id),
      );
      return next;
    });
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    void removeFromSeriesAction(id);
  }

  if (items.length === 0)
    return (
      <p className="text-sm text-zinc-500">
        아직 글이 없습니다. 글 수정 화면에서 시리즈를 지정하세요.
      </p>
    );

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
          {items.map((c, i) => (
            <Row key={c.id} item={c} index={i} onRemove={remove} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function Row({
  item,
  index,
  onRemove,
}: {
  item: Item;
  index: number;
  onRemove: (id: string) => void;
}) {
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
        <button
          type="button"
          aria-label="드래그하여 순서 변경"
          className="cursor-grab touch-none text-zinc-400 select-none active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <span className="text-xs text-zinc-400 tabular-nums">{index + 1}.</span>
        <span className="truncate">{item.title}</span>
        {item.visibility !== "public" && (
          <span className="shrink-0 text-xs text-zinc-400">
            ({item.visibility === "members" ? "회원" : "비공개"})
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="shrink-0 rounded border border-red-300 px-2 py-1 text-red-600"
      >
        제거
      </button>
    </li>
  );
}
