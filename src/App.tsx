import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useStore, visible, type Item } from "./store";

const INDENT = 28;

// Depth the dragged row would land at, based on horizontal drag distance,
// clamped so it can only nest one level under the row above it.
function project(vis: Item[], id: string, overId: string, dx: number) {
  const from = vis.findIndex((i) => i.id === id);
  const to = vis.findIndex((i) => i.id === overId);
  const order = arrayMove(vis, from, to);
  const max = to > 0 ? order[to - 1].depth + 1 : 0;
  const min = order[to + 1]?.depth ?? 0;
  return Math.min(
    Math.max(vis[from].depth + Math.round(dx / INDENT), min),
    max,
  );
}

function Row({
  item,
  depth,
  kids,
}: {
  item: Item;
  depth: number;
  kids: boolean;
}) {
  const s = useStore();
  const ref = useRef<HTMLTextAreaElement>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  useEffect(() => {
    if (s.focusId === item.id) ref.current?.focus();
  }, [s.focusId, item.id]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      s.add(item.id);
    } else if (e.key === "Tab") {
      e.preventDefault();
      s.shift(item.id, e.shiftKey ? -1 : 1);
    } else if (e.key === "Backspace" && !item.text && !kids) {
      e.preventDefault();
      s.remove(item.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`row${item.done ? " done" : ""}${isDragging ? " ghost" : ""}`}
      style={{
        transform: transform
          ? CSS.Translate.toString({ ...transform, x: 0 })
          : undefined,
        transition,
        paddingLeft: depth * INDENT,
      }}
    >
      <button
        className="grip"
        aria-label="Drag to move"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <button
        className={`chev${kids ? "" : " none"}${item.collapsed ? " shut" : ""}`}
        aria-label={item.collapsed ? "Expand" : "Collapse"}
        tabIndex={-1}
        onClick={() => s.update(item.id, { collapsed: !item.collapsed })}
      >
        ▾
      </button>
      <input
        type="checkbox"
        checked={item.done}
        aria-label="Done"
        onChange={(e) => s.update(item.id, { done: e.target.checked })}
      />
      <textarea
        ref={ref}
        rows={1}
        value={item.text}
        placeholder="Task"
        onChange={(e) => s.update(item.id, { text: e.target.value })}
        onKeyDown={onKey}
      />
      <button
        className="x"
        aria-label="Delete task"
        tabIndex={-1}
        onClick={() => s.remove(item.id, true)}
      >
        ×
      </button>
    </div>
  );
}

export default function App() {
  const { items, ready, title, setTitle, load, add, move } = useStore();
  const [drag, setDrag] = useState<{
    id: string;
    over: string;
    dx: number;
  } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    load();
  }, [load]);

  const vis = useMemo(() => visible(items, drag?.id), [items, drag?.id]);
  const parents = useMemo(
    () =>
      new Set(
        items
          .filter((it, i) => (items[i + 1]?.depth ?? 0) > it.depth)
          .map((it) => it.id),
      ),
    [items],
  );
  const projected = drag ? project(vis, drag.id, drag.over, drag.dx) : 0;

  return (
    <main>
      <h1>
        <input
          className="title"
          value={title}
          placeholder="Untitled"
          aria-label="List title"
          style={{ visibility: ready ? "visible" : "hidden" }}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
      </h1>
      {ready && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e) =>
            setDrag({
              id: String(e.active.id),
              over: String(e.active.id),
              dx: 0,
            })
          }
          onDragMove={(e) => setDrag((d) => d && { ...d, dx: e.delta.x })}
          onDragOver={(e) => {
            const o = e.over;
            if (o) setDrag((d) => d && { ...d, over: String(o.id) });
          }}
          onDragEnd={(e) => {
            if (e.over) {
              const id = String(e.active.id);
              const over = String(e.over.id);
              move(id, over, project(vis, id, over, e.delta.x));
            }
            setDrag(null);
          }}
          onDragCancel={() => setDrag(null)}
        >
          <SortableContext
            items={vis.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            {vis.map((it) => (
              <Row
                key={it.id}
                item={it}
                kids={parents.has(it.id)}
                depth={drag?.id === it.id ? projected : it.depth}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}
      <button className="add" onClick={() => add()}>
        + Add task
      </button>
    </main>
  );
}
