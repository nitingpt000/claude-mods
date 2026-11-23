// The built-in buttons, and the parsing for your own. Pure, so the tests check it directly.

import type { Action } from '../types'

export const BUILT_IN: Action[] = [
  {
    id: 'tests',
    icon: '🧪',
    label: 'Run tests',
    prompt: "Run this project's tests and summarize the results. If anything fails, explain why, but don't change any code yet.",
  },
  {
    id: 'review',
    icon: '🔍',
    label: 'Review changes',
    prompt: 'Review the uncommitted changes for bugs, edge cases and security problems. List what you find, most serious first, and don\'t change any code.',
  },
  {
    id: 'lint',
    icon: '🧹',
    label: 'Lint & fix',
    prompt: 'Run the linter and formatter this project uses, then fix what they report. Tell me what you changed.',
  },
  {
    id: 'commit',
    icon: '💾',
    label: 'Commit',
    prompt: "Look at the current changes and commit them with a clear, conventional message. Don't push.",
  },
  {
    id: 'error',
    icon: '❓',
    label: 'Explain last error',
    prompt: 'Explain the most recent error or failure in plain words, and suggest how to fix it.',
  },
  {
    id: 'undo',
    icon: '↩',
    label: 'Undo last edit',
    prompt: 'Undo the last edit you made to a file, and tell me exactly what you reverted.',
  },
  {
    id: 'summary',
    icon: '📝',
    label: 'Summarize session',
    prompt: "Summarize what we've done so far this session in 3 to 5 bullets, then list anything left unfinished.",
  },
]

const ICONS = ['⚡', '🚀', '🎯', '🛠', '📦', '🔁', '🧭', '✨']

// A custom action from "Label | prompt", or from a prompt alone (the label is its opening words).
export function parseAction(text: string, id: string): Action | undefined {
  const raw = text.trim()
  if (raw === '') return undefined
  const bar = raw.indexOf('|')
  const label = bar > 0 ? raw.slice(0, bar).trim() : ''
  const prompt = (bar > 0 ? raw.slice(bar + 1) : raw).trim()
  if (prompt === '') return undefined
  const words = prompt.replace(/\s+/g, ' ').split(' ')
  const short = label !== '' ? label : words.slice(0, 4).join(' ') + (words.length > 4 ? '…' : '')
  const icon = ICONS[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % ICONS.length]!
  return { id, icon, label: short.length > 28 ? `${short.slice(0, 27)}…` : short, prompt }
}

export function clock(ms: number): string {
  const d = new Date(ms)
  const two = (v: number) => String(v).padStart(2, '0')
  return `${two(d.getHours())}:${two(d.getMinutes())}`
}
