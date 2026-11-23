import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { parseLast, parseNumstat, parseStatus, withCounts } from '../hooks/git.js'

const PANE = {
  plugin: 'git-pulse',
  component: 'Pane',
  requestId: 'git-pulse',
  props: {
    title: 'Git pulse',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 48 },
    view: {},
  },
} as const

// Real `git status --porcelain=v2 --branch` output, trimmed of object ids.
const STATUS = [
  '# branch.oid 1111111111111111111111111111111111111111',
  '# branch.head main',
  '# branch.upstream origin/main',
  '# branch.ab +2 -1',
  '1 M. N... 100644 100644 100644 aaaa bbbb src/auth/token.ts',
  '1 .M N... 100644 100644 100644 aaaa bbbb README.md',
  '1 MM N... 100644 100644 100644 aaaa bbbb src/app.ts',
  '2 R. N... 100644 100644 100644 aaaa bbbb R100 src/new name.ts\tsrc/old.ts',
  'u UU N... 100644 100644 100644 100644 aaaa bbbb cccc conflict.txt',
  '? notes.md',
].join('\n')

test('status: branch, upstream, ahead/behind, and each area', async () => {
  const s = parseStatus(STATUS)
  expect([s.branch, s.upstream, s.ahead, s.behind, s.isDetached]).toEqual(['main', 'origin/main', 2, 1, false])
  expect(s.changes.map(c => `${c.area}:${c.code}:${c.path}`)).toEqual([
    'staged:M:src/auth/token.ts',
    'unstaged:M:README.md',
    'staged:M:src/app.ts',
    'unstaged:M:src/app.ts',
    'staged:R:src/new name.ts',
    'conflict:U:conflict.txt',
    'untracked:?:notes.md',
  ])
  expect(parseStatus('# branch.head (detached)\n').isDetached).toBe(true)
})

test('numstat: counts, binary files, and renames keep the new path', async () => {
  const m = parseNumstat('12\t3\tsrc/a.ts\n-\t-\timg/logo.png\n4\t0\tsrc/{old => new}/b.ts\n1\t1\told.ts => fresh.ts\n')
  expect(m.get('src/a.ts')).toEqual({ added: 12, removed: 3 })
  expect(m.get('img/logo.png')).toEqual({ added: 0, removed: 0 })
  expect(m.get('src/new/b.ts')).toEqual({ added: 4, removed: 0 })
  expect(m.get('fresh.ts')).toEqual({ added: 1, removed: 1 })
  const counted = withCounts(parseStatus(STATUS).changes, m, new Map([['README.md', { added: 5, removed: 2 }]]))
  expect(counted.find(c => c.path === 'README.md')).toMatchObject({ added: 5, removed: 2 })
})

test('the last commit line', async () => {
  expect(parseLast('a1b2c3d\tAdd File Heatmap\t3 minutes ago\n')).toEqual({ hash: 'a1b2c3d', subject: 'Add File Heatmap', when: '3 minutes ago' })
  expect(parseLast('')).toBeUndefined()
})

// A fake git: answers each command by its arguments.
function fakeGit(on: Parameters<TestBody>[1], repo: boolean, calls: string[][]) {
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 23, 12, 0, 0) }))
  on('command.register', () => ({ value: { command: 'git-pulse' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('process.run', (_, e) => {
    const argv = [...(e as { argv: readonly string[] }).argv]
    calls.push(argv)
    const sub = argv.slice(1).join(' ')
    const ok = (stdout: string) => ({ value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    if (!repo) return { value: { exitCode: 128, stdout: '', stderr: 'fatal: not a git repository', isStdoutTruncated: false, isStderrTruncated: false } }
    if (sub.startsWith('rev-parse')) return ok('true\n')
    if (sub.startsWith('status')) return ok(STATUS)
    if (sub.startsWith('diff --cached')) return ok('10\t2\tsrc/auth/token.ts\n')
    if (sub.startsWith('diff')) return ok('5\t1\tREADME.md\n')
    if (sub.startsWith('log')) return ok('a1b2c3d\tAdd File Heatmap\t3 minutes ago\n')
    if (sub.startsWith('stash')) return ok('stash@{0}: WIP\n')
    return ok('')
  })
}

test('the panel shows branch, sync, changes by area and the last commit, on every surface', async ($, on) => {
  const calls: string[][] = []
  fakeGit(on, true, calls)
  await $.session.start({ cwd: '/repo', surface: 'desktop', isInteractive: true })

  const first = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await first.press({ key: 'refresh' })
  await first.unmount()

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /^main$/ }))?.text).toBe('main')
    expect((await ui.find({ type: 'Text', text: /^↑ 2$/ }))?.text).toBe('↑ 2')
    expect((await ui.find({ type: 'Text', text: /^↓ 1$/ }))?.text).toBe('↓ 1')
    expect((await ui.find({ type: 'Text', text: /2 commits to push · 1 to pull/ }))?.text).toContain('tracks origin/main')
    expect((await ui.find({ type: 'Text', text: /last commit a1b2c3d/ }))?.text).toContain('Add File Heatmap')
    expect((await ui.find({ type: 'Text', text: /^6 files changed$/ }))?.text).toBe('6 files changed')
    expect((await ui.find({ type: 'Text', text: /^STAGED · 3$/ }))?.text).toBe('STAGED · 3')
    expect((await ui.find({ type: 'Text', text: /in conflict/ }))?.text).toContain('1 file in conflict')
    expect((await ui.find({ type: 'Text', text: /^📦 1 stash$/ }))?.text).toBe('📦 1 stash')
    expect((await ui.find({ type: 'Text', text: /^token\.ts$/ }))?.text).toBe('token.ts')
    await ui.unmount()
  }
  // It only reads: no command that changes the repository was run.
  expect(calls.every(c => c[0] === 'git' && ['rev-parse', 'status', 'diff', 'log', 'stash'].includes(c[1]!))).toBe(true)
  expect(calls.some(c => c[1] === 'stash' && c[2] !== 'list')).toBe(false)
})

test('outside a repository it says so', async ($, on) => {
  fakeGit(on, false, [])
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'refresh' })
  expect((await ui.find({ type: 'Text', text: /not a git repository/ }))?.text).toContain('not a git repository')
  await ui.unmount()
})
