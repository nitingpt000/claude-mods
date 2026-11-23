import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import type { FileHeat } from '../types'
import { bar, heatColor, hottestFolder, record, relPath, sortFiles, touchOf } from '../hooks/heat.js'

const PANE = {
  plugin: 'file-heatmap',
  component: 'Pane',
  requestId: 'file-heatmap',
  props: {
    title: 'File heatmap',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const f = (path: string, reads: number, edits: number, lastAt = 0): FileHeat => ({ path, reads, edits, added: 0, removed: 0, lastAt })

test('paths read relative to the project, and outside paths shorten', async () => {
  expect(relPath('C:\\repo\\src\\auth\\token.ts', 'C:\\repo')).toBe('src/auth/token.ts')
  expect(relPath('c:/REPO/README.md', 'C:\\repo')).toBe('README.md')
  expect(relPath('/home/me/.config/tool/settings.json', '/repo')).toBe('…/.config/tool/settings.json')
  expect(relPath('src/a.ts', '/repo')).toBe('src/a.ts')
})

test('bars and colors follow the heat; read-only files stay cool', async () => {
  expect(bar(30, 30)).toBe('██████████')
  expect(bar(15, 30)).toBe('█████░░░░░')
  expect(bar(1, 100)).toBe('█░░░░░░░░░')
  expect(heatColor(f('a', 9, 0), 9)).toBe('subtle')
  expect(heatColor(f('a', 0, 3), 9)).toBe('error')
  expect(heatColor(f('a', 1, 1), 9)).toBe('warning')
})

test('the hottest folder and the sort orders', async () => {
  const files = [f('/r/src/auth/a.ts', 0, 3, 1), f('/r/src/auth/b.ts', 2, 0, 3), f('/r/docs/x.md', 1, 0, 2)]
  expect(hottestFolder(files, '/r')).toEqual({ folder: 'src/auth', share: 11 / 12 })
  expect(sortFiles(files, 'hot', '/r').map(x => x.path)).toEqual(['/r/src/auth/a.ts', '/r/src/auth/b.ts', '/r/docs/x.md'])
  expect(sortFiles(files, 'recent', '/r').map(x => x.path)).toEqual(['/r/src/auth/b.ts', '/r/docs/x.md', '/r/src/auth/a.ts'])
  expect(sortFiles(files, 'name', '/r').map(x => x.path)).toEqual(['/r/docs/x.md', '/r/src/auth/a.ts', '/r/src/auth/b.ts'])
})

test('touches fold into one row per file, whatever the slashes or case', async () => {
  const t1 = touchOf('Edit', { file_path: 'C:\\r\\a.ts', old_string: 'x', new_string: 'x\ny' })!
  const t2 = touchOf('Read', { file_path: 'c:/R/A.ts' })!
  const list = record(record([], t1, 10, 1), t2, 20, 2)
  expect(list.length).toBe(1)
  expect(list[0]).toMatchObject({ reads: 1, edits: 1, added: 2, removed: 1, lastAt: 20, editedTurn: 1 })
  expect(touchOf('Bash', { command: 'ls' })).toBeUndefined()
})

function engine(on: Parameters<TestBody>[1], filled: string[]) {
  let now = Date.UTC(2026, 10, 23, 12, 0, 0)
  on('clock.now', () => ({ value: (now += 1000) }))
  on('command.register', () => ({ value: { command: 'heatmap' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => e)
  on('prompt.fill', (_, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })
}

test('the panel ranks files by heat, marks this turn, and @ mentions a file, on every surface', async ($, on) => {
  const filled: string[] = []
  engine(on, filled)
  on('tool.call', (_, e) => ((e as { file_path?: string }).file_path?.endsWith('broken.ts') ? { result: {}, isError: true } : { result: {} }))
  await $.session.start({ cwd: '/repo', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'one', turnId: 't1' })
  await $.tool.call({ tool: 'Read', file_path: '/repo/README.md' })
  await $.tool.call({ tool: 'Read', file_path: '/repo/src/auth/token.ts' })
  await $.turn.start({ text: 'two', turnId: 't2' })
  await $.tool.call({ tool: 'Edit', file_path: '/repo/src/auth/token.ts', old_string: 'a', new_string: 'a\nb\nc' })
  // A failed edit leaves the file alone, so it isn't counted.
  await $.tool.call({ tool: 'Edit', file_path: '/repo/src/broken.ts', old_string: 'a', new_string: 'b' })

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /^2 files$/ }))?.text).toBe('2 files')
    expect((await ui.find({ type: 'Text', text: /1 edited/ }))?.text).toBe('✏️ 1 edited')
    expect((await ui.find({ type: 'Text', text: /1 read only/ }))?.text).toBe('👁 1 read only')
    expect((await ui.find({ type: 'Text', text: /^token\.ts$/ }))?.text).toBe('token.ts')
    expect((await ui.find({ type: 'Text', text: /^src\/auth$/ }))?.text).toBe('src/auth')
    expect((await ui.find({ type: 'Text', text: /this turn$/ }))?.text).toBe('🔥 this turn')
    expect((await ui.find({ type: 'Text', text: /Hottest folder: src\/auth/ }))?.text).toContain('src/auth')
    // Each file has a heat bar: the hottest full, a read-only file a short one.
    expect((await ui.find({ key: 'bar-/repo/src/auth/token.ts' }))?.props.width).toBe('100%')
    expect((await ui.find({ key: 'bar-/repo/README.md' }))?.props.width).toBe('25%')
    expect(await ui.find({ type: 'Text', text: /broken/ })).toBeUndefined()
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'at-/repo/src/auth/token.ts' })
  expect(filled).toEqual(['@src/auth/token.ts '])
  expect((await ui.find({ type: 'Text', text: /^README\.md$/ }))?.text).toBe('README.md')
  await ui.press({ key: 'show' })
  expect(await ui.find({ type: 'Text', text: /^README\.md$/ })).toBeUndefined()
  await ui.unmount()
})

test('an empty heatmap says so', async ($, on) => {
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /No files yet/ }))?.text).toContain('No files yet')
  await ui.unmount()
})
