// Parsing git's own output into a snapshot. Pure, so the tests feed it sample output.

import type { Change } from '../types'

export type Status = {
  branch?: string
  isDetached: boolean
  upstream?: string
  ahead: number
  behind: number
  changes: Change[]
}

// git status --porcelain=v2 --branch: header lines start with "# ", entries with
// 1 (changed), 2 (renamed or copied), u (unmerged) or ? (untracked).
export function parseStatus(out: string): Status {
  const s: Status = { isDetached: false, ahead: 0, behind: 0, changes: [] }
  for (const line of out.split(/\r?\n/)) {
    if (line.startsWith('# branch.head ')) {
      const head = line.slice('# branch.head '.length)
      if (head === '(detached)') s.isDetached = true
      else s.branch = head
    } else if (line.startsWith('# branch.upstream ')) {
      s.upstream = line.slice('# branch.upstream '.length)
    } else if (line.startsWith('# branch.ab ')) {
      const m = /\+(\d+) -(\d+)/.exec(line)
      if (m) {
        s.ahead = Number(m[1])
        s.behind = Number(m[2])
      }
    } else if (line.startsWith('1 ') || line.startsWith('2 ')) {
      const parts = line.split(' ')
      const xy = parts[1] ?? '..'
      // A rename's line ends "<path>\t<original path>"; the path starts at field 9 (1) or 10 (2).
      const rest = parts.slice(line.startsWith('1 ') ? 8 : 9).join(' ')
      const path = unquote(rest.split('\t')[0] ?? rest)
      if (xy[0] !== '.') s.changes.push({ path, area: 'staged', code: xy[0]!, added: 0, removed: 0 })
      if (xy[1] !== '.') s.changes.push({ path, area: 'unstaged', code: xy[1]!, added: 0, removed: 0 })
    } else if (line.startsWith('u ')) {
      const path = unquote(line.split(' ').slice(10).join(' '))
      s.changes.push({ path, area: 'conflict', code: 'U', added: 0, removed: 0 })
    } else if (line.startsWith('? ')) {
      s.changes.push({ path: unquote(line.slice(2)), area: 'untracked', code: '?', added: 0, removed: 0 })
    }
  }
  return s
}

// git quotes a path with unusual characters: "a\"b".
function unquote(p: string): string {
  const t = p.trim()
  return t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1).replace(/\\(.)/g, '$1') : t
}

// git diff --numstat: "added<TAB>removed<TAB>path", "-" for binary files. A rename
// reads "old => new" or "dir/{old => new}/file"; the new path is the one kept.
export function parseNumstat(out: string): Map<string, { added: number; removed: number }> {
  const map = new Map<string, { added: number; removed: number }>()
  for (const line of out.split(/\r?\n/)) {
    const [a, r, ...rest] = line.split('\t')
    if (rest.length === 0) continue
    let path = rest.join('\t')
    path = path.replace(/\{[^{}]* => ([^{}]*)\}/, '$1').replace(/^.* => /, '').replace(/\/\//g, '/')
    map.set(unquote(path), { added: a === '-' ? 0 : Number(a) || 0, removed: r === '-' ? 0 : Number(r) || 0 })
  }
  return map
}

// Line counts onto the changes: staged ones from the staged diff, unstaged from the working diff.
export function withCounts(changes: Change[], staged: Map<string, { added: number; removed: number }>, unstaged: Map<string, { added: number; removed: number }>): Change[] {
  return changes.map(c => {
    const n = c.area === 'staged' ? staged.get(c.path) : c.area === 'unstaged' ? unstaged.get(c.path) : undefined
    return n ? { ...c, ...n } : c
  })
}

// git log -1 --format=%h%x09%s%x09%cr
export function parseLast(out: string): { hash: string; subject: string; when: string } | undefined {
  const [hash, subject, when] = out.trim().split('\t')
  return hash && subject !== undefined && when ? { hash, subject, when } : undefined
}

export const CODE_WORDS: Record<string, string> = {
  M: 'modified',
  A: 'added',
  D: 'deleted',
  R: 'renamed',
  C: 'copied',
  T: 'type changed',
  '?': 'untracked',
  U: 'conflict',
}

export function codeColor(code: string): string {
  if (code === 'A' || code === '?') return 'success'
  if (code === 'D' || code === 'U') return 'error'
  if (code === 'R' || code === 'C') return 'claude'
  return 'warning'
}

// Tool calls after which the repository may have changed.
const CHANGERS = new Set(['Bash', 'PowerShell', 'Edit', 'MultiEdit', 'Write', 'NotebookEdit'])
export const mayChangeRepo = (tool: string) => CHANGERS.has(tool)
