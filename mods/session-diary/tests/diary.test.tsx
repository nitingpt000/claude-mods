import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { clip, describe, duration, shortPath } from '../hooks/describe.js'

const PANE = {
  plugin: 'session-diary',
  component: 'Pane',
  requestId: 'session-diary',
  props: {
    title: 'Session diary',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

test('describe turns tool inputs into diary lines', async () => {
  expect(describe('Bash', { command: 'npm   test' })).toEqual({ kind: 'command', label: 'npm test' })
  expect(describe('Edit', { file_path: 'C:\\repo\\src\\auth\\token.ts', old_string: 'a\nb', new_string: 'a\nb\nc' })).toEqual({
    kind: 'edit',
    label: 'auth/token.ts',
    added: 3,
    removed: 2,
  })
  expect(describe('Write', { file_path: '/x/notes.md', content: '1\n2\n3\n4' }).added).toBe(4)
  expect(describe('Grep', { pattern: 'TODO' })).toEqual({ kind: 'search', label: 'TODO' })
  expect(describe('mcp__github__create_issue', {}).label).toBe('create_issue (github)')
  expect(shortPath('/a/b/c/d.ts')).toBe('c/d.ts')
  expect(clip('x'.repeat(100), 10).length).toBe(10)
  expect(duration(450)).toBe('450ms')
  expect(duration(3200)).toBe('3.2s')
  expect(duration(125_000)).toBe('2m 5s')
})

// A clock that moves 1.5 s every time it is read, so each call takes a known time.
function fakeClock(on: Parameters<TestBody>[1]) {
  let now = Date.UTC(2026, 10, 23, 12, 0, 0)
  on('clock.now', () => ({ value: (now += 1500) }))
}

test('the diary lists a prompt, a command and an edit, on every surface', async ($, on) => {
  fakeClock(on)
  on('command.register', () => ({ value: { command: 'diary' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_, e) => e)
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'Split the token logic into its own file', wait: false, origin: { kind: 'composer' } })
  // An automated prompt, such as a background task's notice, is not logged as yours.
  await $.prompt.submit({ text: 'Background task finished', wait: false, origin: { kind: 'task-notification' } })
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  await $.tool.call({ tool: 'Edit', file_path: '/repo/src/token.ts', old_string: 'a', new_string: 'a\nb' })

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /Split the token logic/ }))?.text).toContain('Split the token logic')
    expect((await ui.find({ type: 'Text', text: /^npm test$/ }))?.text).toBe('npm test')
    expect((await ui.find({ type: 'Text', text: /src\/token\.ts/ }))?.text).toBe('src/token.ts')
    expect((await ui.find({ type: 'Text', text: /^ \+2$/ }))?.text).toBe(' +2')
    expect((await ui.find({ type: 'Text', text: /2 calls/ }))?.text).toBe('2 calls')
    expect(await ui.find({ type: 'Text', text: /Background task finished/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('a failed command shows as failed and the Failures filter keeps only it', async ($, on) => {
  fakeClock(on)
  on('command.register', () => ({ value: { command: 'diary' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', (_, e) => (e.tool === 'Bash' ? { result: {}, isError: true } : { result: {} }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'git push' })
  await $.tool.call({ tool: 'Read', file_path: '/repo/README.md' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /failed$/ }))?.text).toContain('failed')
  await ui.press({ key: 'f-failures' })
  expect(await ui.find({ type: 'Text', text: /README\.md/ })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /^git push$/ }))?.text).toBe('git push')
  await ui.unmount()
})

test('an empty diary says so', async ($, on) => {
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /Nothing yet/ }))?.text).toContain('Nothing yet')
  await ui.unmount()
})
