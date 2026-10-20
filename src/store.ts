import { create } from 'zustand'
import Dexie, { type Table } from 'dexie'
import { arrayMove } from '@dnd-kit/sortable'

// Flat list in display order; nesting is expressed by `depth`.
// An item's children are the items right after it with a greater depth.
export type Item = { id: string; depth: number; text: string; done: boolean; collapsed: boolean }

const db = new Dexie('tasks') as Dexie & { kv: Table<{ key: string; value: Item[] }, string> }
db.version(1).stores({ kv: 'key' })

const mk = (text = '', depth = 0): Item => ({ id: crypto.randomUUID(), depth, text, done: false, collapsed: false })
const end = (a: Item[], i: number) => {
  let j = i + 1
  while (j < a.length && a[j].depth > a[i].depth) j++
  return j
}

/** Items on screen: hides children of collapsed items (and of `hideUnder`, the dragged item). */
export function visible(items: Item[], hideUnder?: string | null) {
  const out: Item[] = []
  let skip = Infinity
  for (const it of items) {
    if (it.depth > skip) continue
    skip = Infinity
    out.push(it)
    if (it.collapsed || it.id === hideUnder) skip = it.depth
  }
  return out
}

type S = {
  items: Item[]
  ready: boolean
  focusId: string | null
  load(): Promise<void>
  add(afterId?: string): void
  update(id: string, patch: Partial<Item>): void
  remove(id: string, whole?: boolean): void
  shift(id: string, delta: 1 | -1): void
  move(id: string, overId: string, depth: number): void
}

export const useStore = create<S>()((set, get) => {
  const commit = (items: Item[], focusId: string | null = null) => {
    set({ items, focusId })
    db.kv.put({ key: 'items', value: items }).catch(console.error)
  }
  return {
    items: [],
    ready: false,
    focusId: null,

    async load() {
      const row = await db.kv.get('items')
      set({
        ready: true,
        items: row?.value ?? [
          mk('Drag the handle on the left to reorder or nest'),
          mk('Tab indents, Shift+Tab outdents', 1),
          mk('Enter adds a task, Backspace on an empty one removes it', 1),
        ],
      })
    },

    add(afterId) {
      const a = get().items.slice()
      const i = afterId ? a.findIndex((x) => x.id === afterId) : -1
      let at = a.length
      let depth = 0
      if (i >= 0) {
        const open = (a[i + 1]?.depth ?? 0) > a[i].depth && !a[i].collapsed
        at = open ? i + 1 : end(a, i)
        depth = a[i].depth + (open ? 1 : 0)
      }
      const n = mk('', depth)
      a.splice(at, 0, n)
      commit(a, n.id)
    },

    update(id, patch) {
      commit(get().items.map((x) => (x.id === id ? { ...x, ...patch } : x)), get().focusId)
    },

    remove(id, whole) {
      const a = get().items.slice()
      const i = a.findIndex((x) => x.id === id)
      a.splice(i, whole ? end(a, i) - i : 1)
      commit(a, a[i - 1]?.id ?? null)
    },

    shift(id, d) {
      const a = get().items.slice()
      const i = a.findIndex((x) => x.id === id)
      if (d > 0 ? i < 1 || a[i].depth > a[i - 1].depth : a[i].depth < 1) return
      const e = end(a, i)
      for (let j = i; j < e; j++) a[j] = { ...a[j], depth: a[j].depth + d }
      if (d > 0 && a[i - 1].depth === a[i].depth - 1 && a[i - 1].collapsed) a[i - 1] = { ...a[i - 1], collapsed: false }
      commit(a, id)
    },

    move(id, overId, depth) {
      const items = get().items
      const vis = visible(items, id)
      const order = arrayMove(vis, vis.findIndex((x) => x.id === id), vis.findIndex((x) => x.id === overId))
      const prev = order[order.findIndex((x) => x.id === id) - 1]
      const a = items.slice()
      const s = a.findIndex((x) => x.id === id)
      const block = a.splice(s, end(a, s) - s)
      const delta = depth - block[0].depth
      const at = prev ? end(a, a.findIndex((x) => x.id === prev.id)) : 0
      a.splice(at, 0, ...block.map((x) => ({ ...x, depth: x.depth + delta })))
      commit(a)
    },
  }
})
