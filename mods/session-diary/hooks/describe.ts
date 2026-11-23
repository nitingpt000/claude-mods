// Turns a tool call's input into a diary line: what kind it is, a short label, and for
// edits the lines added and removed. Pure, so the tests can check it directly.

import type { Kind } from '../types'

type Input = Record<string, unknown>

const text = (input: Input, key: string): string | undefined => {
  const v = input[key]
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

const lines = (s: string | undefined): number => (s === undefined || s === '' ? 0 : s.split('\n').length)

// One line, at most `max` characters.
export function clip(s: string, max = 64): string {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, max - 1)}…` : one
}

// The last two parts of a path, which say enough without filling the row.
export function shortPath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean)
  return parts.slice(-2).join('/') || p
}

const EDITS = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit'])
const COMMANDS = new Set(['Bash', 'PowerShell', 'BashOutput', 'KillShell'])
const READS = new Set(['Read', 'NotebookRead', 'LS'])
const SEARCHES = new Set(['Grep', 'Glob', 'ToolSearch'])
const WEB = new Set(['WebFetch', 'WebSearch'])
const AGENTS = new Set(['Agent', 'Task', 'Workflow'])

export type Described = { kind: Kind; label: string; added?: number; removed?: number }

export function describe(tool: string, input: Input): Described {
  const path = text(input, 'file_path') ?? text(input, 'notebook_path') ?? text(input, 'path')
  if (EDITS.has(tool)) {
    let added = 0
    let removed = 0
    if (tool === 'Write') added = lines(text(input, 'content'))
    else if (tool === 'MultiEdit' && Array.isArray(input.edits)) {
      for (const edit of input.edits as Input[]) {
        added += lines(text(edit, 'new_string'))
        removed += lines(text(edit, 'old_string'))
      }
    } else {
      added = lines(text(input, 'new_string') ?? text(input, 'new_source'))
      removed = lines(text(input, 'old_string'))
    }
    return { kind: 'edit', label: path ? shortPath(path) : tool, added, removed }
  }
  if (COMMANDS.has(tool)) return { kind: 'command', label: clip(text(input, 'command') ?? text(input, 'description') ?? tool) }
  if (READS.has(tool)) return { kind: 'read', label: path ? shortPath(path) : tool }
  if (SEARCHES.has(tool)) return { kind: 'search', label: clip(text(input, 'pattern') ?? text(input, 'query') ?? tool) }
  if (WEB.has(tool)) return { kind: 'web', label: clip(text(input, 'url') ?? text(input, 'query') ?? tool) }
  if (AGENTS.has(tool)) return { kind: 'agent', label: clip(text(input, 'description') ?? text(input, 'prompt') ?? tool) }
  // MCP tools arrive as mcp__server__tool: show the server and the tool.
  if (tool.startsWith('mcp__')) {
    const [, server = '', name = tool] = tool.split('__')
    return { kind: 'other', label: `${name} (${server.replace(/^[0-9a-f-]{20,}$/, 'connector')})` }
  }
  return { kind: 'other', label: tool }
}

// A clock time, HH:MM:SS, in the local time of the machine the mod runs on.
export function clock(ms: number): string {
  const d = new Date(ms)
  const two = (v: number) => String(v).padStart(2, '0')
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`
}

export function duration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60_000)
  return `${m}m ${Math.round((ms % 60_000) / 1000)}s`
}
