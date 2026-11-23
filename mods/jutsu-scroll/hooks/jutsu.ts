// The built-in jutsu, hand signs, chakra and mastery. Pure, so the tests check it directly.

import type { Jutsu, Rank } from '../types'

export const CHAKRA_MAX = 100
// Chakra a finished turn restores.
export const CHAKRA_REGEN = 15

export const BUILT_IN: Jutsu[] = [
  {
    id: 'tests',
    name: 'Trial of Blades',
    does: 'Run the tests',
    rank: 'C',
    chakra: 20,
    prompt: "Run this project's tests and summarize the results. If anything fails, explain why, but don't change any code yet.",
  },
  {
    id: 'review',
    name: 'Eye of Scrutiny',
    does: 'Review the changes',
    rank: 'B',
    chakra: 30,
    prompt: "Review the uncommitted changes for bugs, edge cases and security problems. List what you find, most serious first, and don't change any code.",
  },
  {
    id: 'lint',
    name: 'Clean Sweep',
    does: 'Lint and fix',
    rank: 'C',
    chakra: 20,
    prompt: 'Run the linter and formatter this project uses, then fix what they report. Tell me what you changed.',
  },
  {
    id: 'commit',
    name: 'Sealing Technique',
    does: 'Commit the changes',
    rank: 'B',
    chakra: 25,
    prompt: "Look at the current changes and commit them with a clear, conventional message. Don't push.",
  },
  {
    id: 'error',
    name: 'Reading the Enemy',
    does: 'Explain the last error',
    rank: 'D',
    chakra: 10,
    prompt: 'Explain the most recent error or failure in plain words, and suggest how to fix it.',
  },
  {
    id: 'undo',
    name: 'Substitution',
    does: 'Undo the last edit',
    rank: 'A',
    chakra: 35,
    prompt: 'Undo the last edit you made to a file, and tell me exactly what you reverted.',
  },
  {
    id: 'summary',
    name: 'Mission Report',
    does: 'Summarize the session',
    rank: 'D',
    chakra: 10,
    prompt: "Summarize what we've done so far this session in 3 to 5 bullets, then list anything left unfinished.",
  },
]

export const RANK_COLOR: Record<Rank, string> = { S: 'claude', A: 'error', B: 'warning', C: 'success', D: 'subtle' }

// The twelve hand signs of the old lore, one per animal of the zodiac.
const SIGNS = ['🐀', '🐂', '🐅', '🐇', '🐉', '🐍', '🐎', '🐐', '🐒', '🐓', '🐕', '🐗']

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)

// Three hand signs for a jutsu, the same every time for the same jutsu.
export function handSigns(id: string): string {
  let h = hash(id)
  const out: string[] = []
  for (let i = 0; i < 3; i++) {
    out.push(SIGNS[h % SIGNS.length]!)
    h = Math.floor(h / SIGNS.length) + 7 * (i + 1)
  }
  return out.join(' ')
}

// Mastery from casts: ☆ untried, then ★ to ★★★★★ at 1, 3, 6, 10 and 15 casts.
export function masteryLevel(casts: number): number {
  return [1, 3, 6, 10, 15].filter(n => casts >= n).length
}

export function masteryStars(casts: number): string {
  const level = masteryLevel(casts)
  return level === 0 ? '☆ untried' : '★'.repeat(level) + '☆'.repeat(5 - level)
}

export const MASTERY_TITLES = ['Untried', 'Novice', 'Practiced', 'Skilled', 'Expert', 'Master']

// Chakra after casting: never below zero. A cast is never refused for lack of chakra.
export const spend = (chakra: number, cost: number) => Math.max(0, chakra - cost)
export const regen = (chakra: number) => Math.min(CHAKRA_MAX, chakra + CHAKRA_REGEN)

export function chakraWord(chakra: number): { word: string; color: string } {
  if (chakra >= 70) return { word: 'full of chakra', color: 'success' }
  if (chakra >= 35) return { word: 'steady', color: 'warning' }
  if (chakra > 0) return { word: 'running low', color: 'error' }
  return { word: 'running on fumes', color: 'error' }
}

// A forged jutsu from "Name | prompt", or a prompt alone (the name is its opening words).
// Its rank and cost follow the prompt's length: a longer order is a bigger technique.
export function forge(text: string, id: string): Jutsu | undefined {
  const raw = text.trim()
  if (raw === '') return undefined
  const bar = raw.indexOf('|')
  const named = bar > 0 ? raw.slice(0, bar).trim() : ''
  const prompt = (bar > 0 ? raw.slice(bar + 1) : raw).trim()
  if (prompt === '') return undefined
  const words = prompt.replace(/\s+/g, ' ').split(' ')
  const name = named !== '' ? named : words.slice(0, 3).join(' ') + (words.length > 3 ? '…' : '')
  const rank: Rank = words.length > 60 ? 'S' : words.length > 35 ? 'A' : words.length > 18 ? 'B' : words.length > 8 ? 'C' : 'D'
  const chakra = { S: 45, A: 35, B: 25, C: 15, D: 10 }[rank]
  return { id, name: name.length > 28 ? `${name.slice(0, 27)}…` : name, does: 'Your own jutsu', rank, chakra, prompt }
}

export function clock(ms: number): string {
  const d = new Date(ms)
  const two = (v: number) => String(v).padStart(2, '0')
  return `${two(d.getHours())}:${two(d.getMinutes())}`
}
