// Mission ranks, shinobi ranks and the words for each outcome. Pure, so the tests can
// check them directly.

import type { Mission, Outcome } from '../types'

export type Rank = 'S' | 'A' | 'B' | 'C' | 'D'

// A mission's rank is how much work it took: the more actions, the harder the mission.
export function rankOf(actions: number): Rank {
  if (actions >= 31) return 'S'
  if (actions >= 16) return 'A'
  if (actions >= 8) return 'B'
  if (actions >= 3) return 'C'
  return 'D'
}

export const RANK_COLOR: Record<Rank, string> = {
  S: 'claude',
  A: 'error',
  B: 'warning',
  C: 'success',
  D: 'subtle',
}

// The shinobi's own rank grows with missions completed this session.
export function shinobiRank(done: number): string {
  if (done >= 30) return 'Shadow master'
  if (done >= 15) return 'Jōnin'
  if (done >= 5) return 'Chūnin'
  if (done >= 1) return 'Genin'
  return 'Academy student'
}

// The next rank and how many missions until it, or undefined at the top.
export function nextRank(done: number): { name: string; left: number } | undefined {
  for (const [at, name] of [[1, 'Genin'], [5, 'Chūnin'], [15, 'Jōnin'], [30, 'Shadow master']] as const) {
    if (done < at) return { name, left: at - done }
  }
  return undefined
}

export function outcomeOf(reason: 'answer' | 'aborted' | 'refusal' | 'error', setbacks: number): Outcome {
  if (reason === 'aborted') return 'called-off'
  if (reason === 'error') return 'failed'
  if (reason === 'refusal') return 'declined'
  return setbacks === 0 ? 'clean' : 'setbacks'
}

export const OUTCOME_WORDS: Record<Outcome, string> = {
  active: '🗡 under way',
  clean: '⭐ flawless',
  setbacks: '⚔ completed with setbacks',
  'called-off': '🏳 called off',
  failed: '✘ failed',
  declined: '⊘ declined',
}

// Clean missions in a row, counting back from the newest finished one.
export function streak(missions: Mission[]): number {
  let n = 0
  for (let i = missions.length - 1; i >= 0; i--) {
    const m = missions[i]!
    if (m.outcome === 'active') continue
    if (m.outcome !== 'clean') break
    n++
  }
  return n
}

export function clip(s: string, max = 70): string {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, max - 1)}…` : one
}

const shortPath = (p: string) => p.replace(/\\/g, '/').split('/').filter(Boolean).slice(-2).join('/') || p

// The newest action in a few words: the command, the file, or the tool's name.
export function actionWords(tool: string, input: Record<string, unknown>): string {
  const s = (k: string) => (typeof input[k] === 'string' && (input[k] as string) !== '' ? (input[k] as string) : undefined)
  const path = s('file_path') ?? s('notebook_path')
  if (tool === 'Bash' || tool === 'PowerShell') return `▶ ${clip(s('command') ?? tool, 48)}`
  if (path !== undefined && /Edit|Write/.test(tool)) return `✏️ ${shortPath(path)}`
  if (path !== undefined) return `📄 ${shortPath(path)}`
  if (s('pattern') !== undefined) return `🔎 ${clip(s('pattern')!, 40)}`
  if (tool.startsWith('mcp__')) return `🧩 ${tool.split('__')[2] ?? tool}`
  return `• ${tool}`
}

export function duration(ms: number): string {
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s`
  const m = Math.floor(ms / 60_000)
  return `${m}m ${Math.round((ms % 60_000) / 1000)}s`
}

export function clock(ms: number): string {
  const d = new Date(ms)
  const two = (v: number) => String(v).padStart(2, '0')
  return `${two(d.getHours())}:${two(d.getMinutes())}`
}
