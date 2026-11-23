import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { BUILT_IN, chakraWord, forge, handSigns, masteryLevel, masteryStars, regen, spend } from '../hooks/jutsu.js'

const PANE = {
  plugin: 'jutsu-scroll',
  component: 'Pane',
  requestId: 'jutsu-scroll',
  props: {
    title: 'Jutsu scroll',
    isFocused: false,
    bodyColumns: 70,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  },
} as const

test('mastery climbs at 1, 3, 6, 10 and 15 casts', async () => {
  expect([0, 1, 2, 3, 5, 6, 9, 10, 14, 15, 40].map(masteryLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
  expect(masteryStars(0)).toBe('☆ untried')
  expect(masteryStars(3)).toBe('★★☆☆☆')
})

test('chakra spends, regenerates and never goes below zero or over the top', async () => {
  expect(spend(20, 35)).toBe(0)
  expect(regen(95)).toBe(100)
  expect(regen(spend(100, 30))).toBe(85)
  expect(chakraWord(0).word).toBe('running on fumes')
  expect(chakraWord(80).word).toBe('full of chakra')
})

test('hand signs are three zodiac signs, the same every time', async () => {
  expect(handSigns('tests').split(' ').length).toBe(3)
  expect(handSigns('tests')).toBe(handSigns('tests'))
})

test('forging names, ranks and prices a jutsu', async () => {
  expect(forge('Deploy Strike | Deploy the app to staging and report the URL', 'j1')).toMatchObject({ name: 'Deploy Strike', rank: 'C', chakra: 15 })
  expect(forge('Check bundle size', 'j2')).toMatchObject({ name: 'Check bundle size', rank: 'D' })
  expect(forge('  ', 'j3')).toBeUndefined()
  expect(forge('Name only |  ', 'j4')).toBeUndefined()
})

type Box = { text: string; cursor: number }

function engine(on: Parameters<TestBody>[1], sent: string[], filled: string[], box: Box, store: Map<string, unknown>) {
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 23, 13, 5, 0) }))
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

const finish = { answer: '', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer', category: null, explanation: null } as const

test('casting sends the prompt, spends chakra and grows mastery, on every surface', async ($, on) => {
  const sent: string[] = []
  const store = new Map<string, unknown>()
  engine(on, sent, [], { text: '', cursor: 0 }, store)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'cast-review' })
  expect(sent).toEqual([BUILT_IN[1]!.prompt])
  expect(store.get('mastery')).toEqual({ review: 1 })
  expect((await ui.find({ type: 'Text', text: /^70 \/ 100/ }))?.text).toBe('70 / 100 · full of chakra')
  expect((await ui.find({ type: 'Text', text: /mastery rose to Novice/ }))?.text).toContain('Eye of Scrutiny')
  expect((await ui.find({ key: 'chakra-bar' }))?.props.width).toBe('70%')
  await ui.unmount()

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const view = await $.ui.mount({ ...PANE, surface })
    expect((await view.find({ type: 'Text', text: /^Eye of Scrutiny$/ }))?.text).toBe('Eye of Scrutiny')
    expect((await view.find({ type: 'Text', text: /★☆☆☆☆ · cast 1×/ }))?.text).toBe('★☆☆☆☆ · cast 1×')
    // Shown in the machine's local time, whatever its zone.
    expect((await view.find({ type: 'Text', text: /Last cast: Eye of Scrutiny/ }))?.text).toMatch(/at \d\d:\d\d$/)
    await view.unmount()
  }
})

test('low chakra never stops a cast, and finished turns restore it', async ($, on) => {
  const sent: string[] = []
  engine(on, sent, [], { text: '', cursor: 0 }, new Map())
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  for (let i = 0; i < 4; i++) await ui.press({ key: 'cast-undo' })
  expect(sent.length).toBe(4)
  expect((await ui.find({ type: 'Text', text: /^0 \/ 100/ }))?.text).toBe('0 / 100 · running on fumes')
  expect((await ui.find({ type: 'Text', text: /cast on fumes/ }))?.text).toContain('Substitution')

  await $.turn.start({ text: 'x', turnId: 't1' })
  await $.turn.complete(finish)
  expect((await ui.find({ type: 'Text', text: /^15 \/ 100/ }))?.text).toBe('15 / 100 · running low')
  await ui.unmount()
})

test('prepare fills the prompt box; forging from the box keeps the jutsu, and ✕ strikes it', async ($, on) => {
  const filled: string[] = []
  const store = new Map<string, unknown>()
  engine(on, [], filled, { text: 'Bump | Bump the patch version and update the changelog', cursor: 0 }, store)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  await ui.press({ key: 'prep-tests' })
  expect(filled).toEqual([BUILT_IN[0]!.prompt])

  await ui.press({ key: 'forge' })
  const saved = store.get('custom-jutsu') as { id: string; name: string }[]
  expect(saved.map(j => j.name)).toEqual(['Bump'])
  expect((await ui.find({ type: 'Text', text: /^YOUR JUTSU · 1$/ }))?.text).toBe('YOUR JUTSU · 1')

  await ui.press({ key: `del-${saved[0]!.id}` })
  expect(store.get('custom-jutsu')).toEqual([])
  await ui.unmount()
})

test('mastery and your jutsu carry over from an earlier session; /jutsu-add forges one', async ($, on) => {
  const store = new Map<string, unknown>([
    ['mastery', { tests: 6 }],
    ['custom-jutsu', [{ id: 'old', name: 'Old Way', does: 'Your own jutsu', rank: 'D', chakra: 10, prompt: 'Do the old thing' }]],
  ])
  engine(on, [], [], { text: '', cursor: 0 }, store)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const out = await $.command.run({ command: 'jutsu-add', args: 'Deploy Strike | Deploy to staging', origin: { kind: 'composer' }, presentation: 'chat' } as never)
  expect(String((out as { text?: string }).text)).toContain('Forged "Deploy Strike"')

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /★★★☆☆ · cast 6×/ }))?.text).toBe('★★★☆☆ · cast 6×')
  expect((await ui.find({ type: 'Text', text: /^Old Way$/ }))?.text).toBe('Old Way')
  expect((await ui.find({ type: 'Text', text: /^Deploy Strike$/ }))?.text).toBe('Deploy Strike')
  await ui.unmount()
})

test('while Claude works, a cast says it will wait its turn', async ($, on) => {
  engine(on, [], [], { text: '', cursor: 0 }, new Map())
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'x', turnId: 't1' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /in battle/ }))?.text).toContain('casts wait their turn')
  await ui.press({ key: 'cast-summary' })
  expect((await ui.find({ type: 'Text', text: /will strike when Claude finishes/ }))?.text).toContain('Mission Report')
  await ui.unmount()
})
