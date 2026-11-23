// Git Pulse: a side panel with the project's git status, kept current. It shows the
// branch and its upstream, how far ahead or behind it is, the last commit, every
// staged, unstaged, untracked and conflicted file with its lines added and removed,
// and the stash count. It reads git again after each command or edit Claude makes,
// at the end of each turn, and on Refresh. Fetch updates ahead/behind from the remote.
//
// It only reads: status, diff --numstat, log and stash list, plus fetch when you press it.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Change, Snapshot } from '../types'
import { CODE_WORDS, codeColor, mayChangeRepo, parseLast, parseNumstat, parseStatus, withCounts } from './git.js'

const PANE = 'git-pulse'
const TITLE = 'Git pulse'

// Change the tag when a snapshot's fields change: it declines what an earlier version
// stored, which outlives a reload.
const snapshot = atom({ plugin: 'git-pulse', key: 'snapshot' } as const, null, { shape: 'snapshot-1' })
const fetchNote = atom({ plugin: 'git-pulse', key: 'fetchNote' } as const, null)
const isFetching = atom({ plugin: 'git-pulse', key: 'isFetching' } as const, false)

// Never let git stop to ask for a password or open an editor.
const QUIET = { GIT_TERMINAL_PROMPT: '0', GIT_EDITOR: 'true', GIT_OPTIONAL_LOCKS: '0' }

async function git($: EngineInterface, args: string[], timeoutMs = 15_000) {
  return $.process.run(['git', ...args], { env: QUIET, timeoutMs })
}

// One read at a time; a request that arrives during a read runs once more after it.
let running = false
let again: string | undefined

async function refresh($: EngineInterface, reason: string): Promise<void> {
  if (running) {
    again = reason
    return
  }
  running = true
  try {
    const checkedAt = await $.clock.now()
    let snap: Snapshot
    try {
      const inside = await git($, ['rev-parse', '--is-inside-work-tree'])
      if (inside.exitCode !== 0 || inside.stdout.trim() !== 'true') {
        snap = { isRepo: false, ahead: 0, behind: 0, changes: [], stashes: 0, checkedAt, reason }
      } else {
        const [status, staged, unstaged, log, stash] = await Promise.all([
          git($, ['status', '--porcelain=v2', '--branch', '--untracked-files=normal']),
          git($, ['diff', '--cached', '--numstat']),
          git($, ['diff', '--numstat']),
          git($, ['log', '-1', '--format=%h%x09%s%x09%cr']),
          git($, ['stash', 'list']),
        ])
        const s = parseStatus(status.stdout)
        const last = log.exitCode === 0 ? parseLast(log.stdout) : undefined
        snap = {
          isRepo: true,
          ...(s.branch !== undefined ? { branch: s.branch } : {}),
          isDetached: s.isDetached,
          ...(s.upstream !== undefined ? { upstream: s.upstream } : {}),
          ahead: s.ahead,
          behind: s.behind,
          changes: withCounts(s.changes, parseNumstat(staged.stdout), parseNumstat(unstaged.stdout)),
          ...(last !== undefined ? { last } : {}),
          stashes: stash.stdout.split(/\r?\n/).filter(l => l.trim() !== '').length,
          checkedAt,
          reason,
          ...(status.exitCode !== 0 ? { error: status.stderr.trim().split('\n')[0] ?? 'git status failed' } : {}),
        }
      }
    } catch (err) {
      // git missing from the PATH, or it timed out.
      snap = { isRepo: false, ahead: 0, behind: 0, changes: [], stashes: 0, checkedAt, reason, error: `Couldn't run git: ${String(err).slice(0, 120)}` }
    }
    await update($, snapshot, () => snap)
  } finally {
    running = false
    const pending = again
    again = undefined
    if (pending !== undefined) await refresh($, pending)
  }
}

async function fetchRemote($: EngineInterface): Promise<void> {
  if (await read($, isFetching)) return
  await update($, isFetching, () => true)
  await update($, fetchNote, () => 'Fetching…')
  try {
    const r = await git($, ['fetch', '--quiet', '--no-recurse-submodules'], 30_000)
    await update($, fetchNote, () => (r.exitCode === 0 ? 'Fetched from the remote.' : `Fetch failed: ${r.stderr.trim().split('\n')[0] || 'no remote, or it needs a login'}`))
  } catch (err) {
    await update($, fetchNote, () => `Fetch failed: ${String(err).slice(0, 100)}`)
  } finally {
    await update($, isFetching, () => false)
  }
  await refresh($, 'after fetching')
}

const clock = (ms: number) => {
  const d = new Date(ms)
  const two = (v: number) => String(v).padStart(2, '0')
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'git-pulse', description: "Open Git Pulse: the project's branch, changes and ahead/behind, kept current" })
    void $.ui.open({ id: PANE, title: TITLE })
    void refresh($, 'at session start')
    return next(e)
  })

  on('command.run', { command: 'git-pulse' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    void refresh($, 'on opening')
    return { text: 'Git Pulse opened.' }
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (mayChangeRepo(e.tool) && ran.deny === undefined) void refresh($, e.tool === 'Bash' || e.tool === 'PowerShell' ? 'after a command' : 'after an edit')
    return ran
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) void refresh($, 'at the end of the turn')
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const s = await read($, snapshot)
    const note = await read($, fetchNote)
    const fetching = await read($, isFetching)

    // A small rounded label.
    const chip = (key: string, text: string, color?: string) => (
      <Box key={key} borderStyle="round" borderColor={color ?? 'subtle'} paddingX={1}>
        <Text size="caption" color={color} weight="medium">{text}</Text>
      </Box>
    )

    const header = (
      <Box flexDirection="column">
        <Text size="heading" weight="bold">🌿 Git pulse</Text>
        <Text size="caption" dimColor>The project's branch and changes, kept current</Text>
      </Box>
    )

    const controls = (
      <Box flexDirection="row" flexWrap="wrap" gap={1}>
        <Button key="refresh" label="↻ Refresh" variant="secondary" onPress={() => refresh($, 'on Refresh')} />
        <Button key="fetch" label={fetching ? 'Fetching…' : '⇣ Fetch'} variant="secondary" onPress={() => fetchRemote($)} />
      </Box>
    )

    if (s === null) {
      return (
        <Box flexDirection="column" gap={1}>
          {header}
          <Text dimColor>Reading git…</Text>
          {controls}
        </Box>
      )
    }
    if (!s.isRepo) {
      return (
        <Box flexDirection="column" gap={1}>
          {header}
          <Box borderStyle="round" borderColor="subtle" paddingX={1} paddingY={1}>
            <Text dimColor>{s.error ?? 'This folder is not a git repository.'}</Text>
          </Box>
          {controls}
        </Box>
      )
    }

    const by = (area: Change['area']) => s.changes.filter(c => c.area === area)
    const staged = by('staged')
    const unstaged = by('unstaged')
    const untracked = by('untracked')
    const conflicts = by('conflict')
    const files = new Set(s.changes.map(c => c.path)).size
    const added = s.changes.reduce((n, c) => n + c.added, 0)
    const removed = s.changes.reduce((n, c) => n + c.removed, 0)
    const room = Math.max(6, (e.viewport?.rows ?? 48) - 22)
    let used = 0

    const fileRow = (c: Change) => {
      const cut = c.path.lastIndexOf('/')
      const name = cut >= 0 ? c.path.slice(cut + 1) : c.path
      const folder = cut >= 0 ? c.path.slice(0, cut) : ''
      return (
        <Box key={`${c.area}-${c.path}`} flexDirection="row" alignItems="center" gap={1}>
          <Box borderStyle="round" borderColor={codeColor(c.code)} paddingX={1}>
            <Text size="caption" mono weight="bold" color={codeColor(c.code)}>{c.code}</Text>
          </Box>
          <Box flexDirection="column" flexGrow={1}>
            <Text mono weight="semibold">{name}</Text>
            {folder !== '' && <Text size="caption" mono dimColor>{folder}</Text>}
          </Box>
          {c.added > 0 && <Text size="caption" color="diffAdded">+{c.added}</Text>}
          {c.removed > 0 && <Text size="caption" color="diffRemoved">−{c.removed}</Text>}
          {c.added === 0 && c.removed === 0 && <Text size="caption" dimColor>{CODE_WORDS[c.code] ?? ''}</Text>}
        </Box>
      )
    }

    const section = (key: string, title: string, list: Change[], color: string) => {
      if (list.length === 0 || used >= room) return null
      const shown = list.slice(0, Math.max(1, room - used))
      used += shown.length
      return (
        <Box key={key} flexDirection="column" borderStyle="round" borderColor={color} paddingX={1}>
          <Text size="caption" weight="bold" color={color}>{title} · {list.length}</Text>
          {shown.map(fileRow)}
          {shown.length < list.length && <Text size="caption" dimColor>…and {list.length - shown.length} more</Text>}
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap={1}>
        {header}

        <Box flexDirection="column" borderStyle="round" borderColor="success" paddingX={1}>
          <Box flexDirection="row" justifyContent="space-between" alignItems="center">
            <Text weight="bold" color="success" mono>{s.isDetached ? 'detached HEAD' : s.branch ?? '(no branch)'}</Text>
            {s.upstream !== undefined ? (
              <Box flexDirection="row" gap={1}>
                {chip('ahead', `↑ ${s.ahead}`, s.ahead > 0 ? 'claude' : undefined)}
                {chip('behind', `↓ ${s.behind}`, s.behind > 0 ? 'warning' : undefined)}
              </Box>
            ) : (
              chip('no-up', 'not pushed yet', 'warning')
            )}
          </Box>
          {s.upstream !== undefined && (
            <Text size="caption" dimColor>
              tracks {s.upstream}
              {s.ahead > 0 ? ` · ${plural(s.ahead, 'commit')} to push` : ''}
              {s.behind > 0 ? ` · ${s.behind} to pull` : ''}
              {s.ahead > 0 || s.behind > 0 ? ' (as of the last fetch)' : ' · in sync'}
            </Text>
          )}
          {s.last !== undefined && (
            <Text size="caption" dimColor>
              last commit {s.last.hash} · {s.last.subject} · {s.last.when}
            </Text>
          )}
        </Box>

        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {files === 0 ? chip('clean', '✔ working tree clean', 'success') : chip('files', plural(files, 'file') + ' changed', 'warning')}
          {staged.length > 0 && chip('c-staged', `${staged.length} staged`, 'success')}
          {unstaged.length > 0 && chip('c-unstaged', `${unstaged.length} unstaged`)}
          {untracked.length > 0 && chip('c-untracked', `${untracked.length} untracked`)}
          {(added > 0 || removed > 0) && chip('c-plus', `+${added}`, 'diffAdded')}
          {(added > 0 || removed > 0) && chip('c-minus', `−${removed}`, 'diffRemoved')}
          {s.stashes > 0 && chip('c-stash', `📦 ${plural(s.stashes, 'stash', 'stashes')}`)}
        </Box>

        {conflicts.length > 0 && <Text color="error" weight="semibold">⚠ {plural(conflicts.length, 'file')} in conflict: resolve before committing</Text>}
        {s.error !== undefined && <Text color="error">{s.error}</Text>}

        {controls}
        {note !== null && <Text size="caption" dimColor>{note}</Text>}

        {section('s-conflict', 'CONFLICTS', conflicts, 'error')}
        {section('s-staged', 'STAGED', staged, 'success')}
        {section('s-unstaged', 'UNSTAGED', unstaged, 'warning')}
        {section('s-untracked', 'UNTRACKED', untracked, 'subtle')}

        <Text size="caption" dimColor>Checked {clock(s.checkedAt)} · {s.reason}</Text>
      </Box>
    )
  })
}
