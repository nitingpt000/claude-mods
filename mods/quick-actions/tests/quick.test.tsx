import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { BUILT_IN, parseAction } from '../hooks/actions.js'

const PANE = {
  plugin: 'quick-actions',
  component: 'Pane',
  requestId: 'quick-actions',
  props: {
    title: 'Quick actions',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('custom actions parse from "Label | prompt" or a prompt alone', async () => {
  expect(parseAction('Deploy | Deploy the app to staging and report the URL', 'c1')).toMatchObject({ label: 'Deploy', prompt: 'Deploy the app to staging and report the URL' })
  expect(parseAction('Check the bundle size of the production build', 'c2')?.label).toBe('Check the bundle size…')
  expect(parseAction('   ', 'c3')).toBeUndefined()
  expect(parseAction('Label only |   ', 'c4')).toBeUndefined()
  expect(BUILT_IN.map(a => a.id)).toEqual(['tests', 'review', 'lint', 'commit', 'error', 'undo', 'summary'])
})

type Box = { text: string; cursor: number }

function engine(on: Parameters<TestBody>[1], sent: string[], filled: string[], box: Box, store: Map<string, unknown>) {
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 23, 12, 30, 0) }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_, e) => {
    sent.push(e.text)
    return e
  })
  on('prompt.fill', (_, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })
  on('prompt.read', () => ({ value: box }))
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('turn.start', (_, e) => e)
  on('turn.complete', (_, e) => ({ text: e.answer }))
}

test('a button sends its prompt, and ✎ puts it in the prompt box', async ($, on) => {
  const sent: string[] = []
  const filled: string[] = []
  engine(on, sent, filled, { text: '', cursor: 0 }, new Map())
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /^BUILT IN$/ }))?.text).toBe('BUILT IN')
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'run-tests' })
  expect(sent).toEqual([BUILT_IN[0]!.prompt])
  expect((await ui.find({ type: 'Text', text: /Last sent: Run tests/ }))?.text).toContain('Run tests')

  await ui.press({ key: 'edit-review' })
  expect(filled).toEqual([BUILT_IN[1]!.prompt])
  expect((await ui.find({ type: 'Text', text: /is in the prompt box/ }))?.text).toContain('Review changes')
  await ui.unmount()
})

test('the prompt box saves as a button, kept in the store, and ✕ removes it', async ($, on) => {
  const store = new Map<string, unknown>()
  const box: Box = { text: 'Bump | Bump the patch version and update the changelog', cursor: 0 }
  const sent: string[] = []
  engine(on, sent, [], box, store)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'save-draft' })
  const saved = store.get('custom-actions') as { id: string; label: string }[]
  expect(saved.map(a => a.label)).toEqual(['Bump'])
  await ui.press({ key: `run-${saved[0]!.id}` })
  expect(sent).toEqual(['Bump the patch version and update the changelog'])

  await ui.press({ key: `del-${saved[0]!.id}` })
  expect(store.get('custom-actions')).toEqual([])
  expect((await ui.find({ type: 'Text', text: /^None yet/ }))?.text).toContain('None yet')
  await ui.unmount()
})

test('an empty prompt box is not saved', async ($, on) => {
  const store = new Map<string, unknown>()
  engine(on, [], [], { text: '  ', cursor: 0 }, store)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'save-draft' })
  expect(store.has('custom-actions')).toBe(false)
  expect((await ui.find({ type: 'Text', text: /Type a prompt in the prompt box first/ }))?.text).toContain('first')
  await ui.unmount()
})

test('/quick-add adds a button; buttons saved before load at session start', async ($, on) => {
  const store = new Map<string, unknown>([['custom-actions', [{ id: 'old', icon: '⚡', label: 'Old one', prompt: 'Do the old thing' }]]])
  engine(on, [], [], { text: '', cursor: 0 }, store)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const out = await $.command.run({ command: 'quick-add', args: 'Deploy | Deploy to staging', origin: { kind: 'composer' }, presentation: 'chat' } as never)
  expect(String((out as { text?: string }).text)).toContain('Added "Deploy"')

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ key: 'run-old' }))?.props.label).toBe('⚡ Old one')
  const buttons = await ui.findAll({ type: 'Button' })
  expect(buttons.some(b => String(b.props.label).endsWith('Deploy'))).toBe(true)
  await ui.unmount()
})

test('while Claude works, a press says it will wait its turn', async ($, on) => {
  engine(on, [], [], { text: '', cursor: 0 }, new Map())
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'something', turnId: 't1' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /a press waits its turn/ }))?.text).toContain('waits its turn')
  await ui.press({ key: 'run-summary' })
  expect((await ui.find({ type: 'Text', text: /will run when Claude finishes/ }))?.text).toContain('Summarize session')
  await ui.unmount()
})
