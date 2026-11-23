// Heat, paths, bars and folder roll-ups. Pure, so the tests check them directly.

import type { FileHeat, Sort } from '../types'

const slash = (p: string) => p.replace(/\\/g, '/')

// A path relative to the project when it's inside it; otherwise its last parts.
export function relPath(path: string, cwd: string): string {
  const p = slash(path)
  const root = slash(cwd).replace(/\/+$/, '')
  if (root !== '' && p.toLowerCase().startsWith(`${root.toLowerCase()}/`)) return p.slice(root.length + 1)
  if (!/^([a-zA-Z]:\/|\/|~)/.test(p)) return p
  const parts = p.split('/').filter(Boolean)
  return parts.length <= 3 ? p : `…/${parts.slice(-3).join('/')}`
}

// An edit counts three times as much as a read: changing a file is the hotter act.
export const heatOf = (f: FileHeat) => f.edits * 3 + f.reads

// A bar of `width` cells, full for the hottest file.
export function bar(heat: number, max: number, width = 10): string {
  const full = max <= 0 ? 0 : Math.max(heat > 0 ? 1 : 0, Math.round((heat / max) * width))
  return '█'.repeat(full) + '░'.repeat(width - full)
}

// The bar's color: read-only files stay cool; edited files warm with their share of the heat.
export function heatColor(f: FileHeat, max: number): string {
  if (f.edits === 0) return 'subtle'
  const share = max <= 0 ? 0 : heatOf(f) / max
  if (share > 0.66) return 'error'
  if (share > 0.33) return 'warning'
  return 'success'
}

export function folderOf(rel: string): string {
  const parts = rel.split('/')
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '.'
}

// The folder with the most heat, and its share of the whole.
export function hottestFolder(files: FileHeat[], cwd: string): { folder: string; share: number } | undefined {
  const sums = new Map<string, number>()
  let total = 0
  for (const f of files) {
    const h = heatOf(f)
    const folder = folderOf(relPath(f.path, cwd))
    sums.set(folder, (sums.get(folder) ?? 0) + h)
    total += h
  }
  let best: string | undefined
  let bestHeat = -1
  for (const [folder, h] of sums) if (h > bestHeat) [best, bestHeat] = [folder, h]
  return best === undefined || total === 0 ? undefined : { folder: best, share: bestHeat / total }
}

export function sortFiles(files: FileHeat[], by: Sort, cwd: string): FileHeat[] {
  const copy = [...files]
  if (by === 'recent') return copy.sort((a, b) => b.lastAt - a.lastAt)
  if (by === 'name') return copy.sort((a, b) => relPath(a.path, cwd).localeCompare(relPath(b.path, cwd)))
  return copy.sort((a, b) => heatOf(b) - heatOf(a) || b.lastAt - a.lastAt)
}

// Which file a tool call touches, and whether it reads or edits it.
const EDITS = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit'])
const READS = new Set(['Read', 'NotebookRead'])

export type Touch = { path: string; kind: 'read' | 'edit'; added: number; removed: number }

const lines = (s: unknown) => (typeof s === 'string' && s !== '' ? s.split('\n').length : 0)

export function touchOf(tool: string, input: Record<string, unknown>): Touch | undefined {
  const p = input.file_path ?? input.notebook_path
  if (typeof p !== 'string' || p === '') return undefined
  if (READS.has(tool)) return { path: p, kind: 'read', added: 0, removed: 0 }
  if (!EDITS.has(tool)) return undefined
  if (tool === 'Write') return { path: p, kind: 'edit', added: lines(input.content), removed: 0 }
  if (tool === 'MultiEdit' && Array.isArray(input.edits)) {
    let added = 0
    let removed = 0
    for (const e of input.edits as Record<string, unknown>[]) {
      added += lines(e.new_string)
      removed += lines(e.old_string)
    }
    return { path: p, kind: 'edit', added, removed }
  }
  return { path: p, kind: 'edit', added: lines(input.new_string ?? input.new_source), removed: lines(input.old_string) }
}

// Fold one touch into the list: the same file (any slash, any case) is one row.
export function record(files: FileHeat[], t: Touch, at: number, turn: number): FileHeat[] {
  const key = slash(t.path).toLowerCase()
  const i = files.findIndex(f => slash(f.path).toLowerCase() === key)
  const base: FileHeat = i >= 0 ? files[i]! : { path: t.path, reads: 0, edits: 0, added: 0, removed: 0, lastAt: at }
  const next: FileHeat = {
    ...base,
    reads: base.reads + (t.kind === 'read' ? 1 : 0),
    edits: base.edits + (t.kind === 'edit' ? 1 : 0),
    added: base.added + t.added,
    removed: base.removed + t.removed,
    lastAt: at,
    ...(t.kind === 'edit' ? { editedTurn: turn } : {}),
  }
  return i >= 0 ? [...files.slice(0, i), next, ...files.slice(i + 1)] : [...files, next]
}
