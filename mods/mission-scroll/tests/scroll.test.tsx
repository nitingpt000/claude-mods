import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import type { Mission } from '../types'
import { actionWords, nextRank, outcomeOf, rankOf, shinobiRank, streak } from '../hooks/ranks.js'

const PANE = {
  plugin: 'mission-scroll',
  component: 'Pane',
  requestId: 'mission-scroll',
  props: {
    title: 'Mission scroll',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('mission ranks follow the work it took', async () => {
  expect([0, 2, 3, 7, 8, 15, 16, 30, 31, 90].map(rankOf)).toEqual(['D', 'D', 'C', 'C', 'B', 'B', 'A', 'A', 'S', 'S'])
})

test('the shinobi rank grows with missions completed', async () => {
  expect([0, 1, 4, 5, 14, 15, 29, 30].map(shinobiRank)).toEqual([
    'Academy student', 'Genin', 'Genin', 'Chūnin', 'Chūnin', 'Jōnin', 'Jōnin', 'Shadow master',
  ])
  expect(nextRank(3)).toEqual({ name: 'Chūnin', left: 2 })
  expect(nextRank(40)).toBeUndefined()
})

test('outcomes and streaks', async () => {
  expect(outcomeOf('answer', 0)).toBe('clean')
  expect(outcomeOf('answer', 2)).toBe('setbacks')
  expect(outcomeOf('aborted', 0)).toBe('called-off')
  expect(outcomeOf('error', 0)).toBe('failed')
  const m = (outcome: Mission['outcome']): Mission => ({ id: outcome, title: '', fromYou: true, startedAt: 0, actions: 0, edits: 0, commands: 0, setbacks: 0, outcome })
  expect(streak([m('setbacks'), m('clean'), m('clean'), m('active')])).toBe(2)
  expect(streak([m('clean'), m('called-off')])).toBe(0)
})

test('the newest action reads in a few words', async () => {
  expect(actionWords('Bash', { command: 'npm test' })).toBe('▶ npm test')
  expect(actionWords('Edit', { file_path: 'C:\\repo\\src\\auth.ts' })).toBe('✏️ src/auth.ts')
  expect(actionWords('Read', { file_path: '/repo/README.md' })).toBe('📄 repo/README.md')
})

function engine(on: Parameters<TestBody>[1]) {
  let now = Date.UTC(2026, 10, 23, 12, 0, 0)
  on('clock.now', () => ({ value: (now += 1500) }))
  on('command.register', () => ({ value: { command: 'missions' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_, e) => e)
  on('turn.start', (_, e) => e)
  on('turn.complete', (_, e) => ({ text: e.answer }))
}

const finish = { answer: 'Done.', durationMs: 72_000, isAborted: false, turnId: 't1', reason: 'answer', category: null, explanation: null } as const

test('a prompt becomes a mission: under way, then ranked and starred, on every surface', async ($, on) => {
  engine(on)
  on('tool.call', () => ({ result: {} }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'Split the token logic into its own file', wait: false, origin: { kind: 'composer' } })
  await $.turn.start({ text: 'Split the token logic into its own file', turnId: 't1' })
  for (let i = 0; i < 9; i++) {
    if (i % 3 === 0) await $.tool.call({ tool: 'Edit', file_path: '/r/a.ts', old_string: 'a', new_string: 'b' })
    else await $.tool.call({ tool: 'Bash', command: `step ${i}` })
  }

  const live = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await live.find({ type: 'Text', text: /MISSION UNDER WAY/ }))?.text).toContain('MISSION UNDER WAY')
  expect((await live.find({ type: 'Text', text: /latest: ▶ step 8/ }))?.text).toBe('latest: ▶ step 8')
  await live.unmount()

  await $.turn.complete(finish)
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /MISSION UNDER WAY/ })).toBeUndefined()
    // The mission's rank badge, and the tally chip for B.
    expect((await ui.find({ type: 'Text', text: /^B$/ }))?.text).toBe('B')
    expect((await ui.find({ type: 'Text', text: /^B · 1$/ }))?.text).toBe('B · 1')
    expect((await ui.find({ type: 'Text', text: /^⭐ flawless$/ }))?.text).toBe('⭐ flawless')
    expect((await ui.find({ type: 'Text', text: /^1 mission$/ }))?.text).toBe('1 mission')
    expect((await ui.find({ type: 'Text', text: /^⭐ 1 flawless$/ }))?.text).toBe('⭐ 1 flawless')
    expect((await ui.find({ type: 'Text', text: /4 more missions to Chūnin/ }))?.text).toBe('4 more missions to Chūnin')
    expect((await ui.find({ type: 'Text', text: /9 actions · 3 edits · 6 commands · 1m 12s/ }))?.text).toContain('9 actions')
    expect((await ui.find({ type: 'Text', text: /^Genin$/ }))?.text).toBe('Genin')
    await ui.unmount()
  }
})

test('a failed action makes a setback; calling a turn off marks it called off', async ($, on) => {
  engine(on)
  on('tool.call', (_, e) => (e.tool === 'Bash' ? { result: {}, isError: true } : { result: {} }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  await $.prompt.submit({ text: 'Run the tests', wait: false, origin: { kind: 'composer' } })
  await $.turn.start({ text: 'Run the tests', turnId: 't1' })
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  await $.turn.complete(finish)

  await $.prompt.submit({ text: 'Deploy it', wait: false, origin: { kind: 'composer' } })
  await $.turn.start({ text: 'Deploy it', turnId: 't2' })
  await $.turn.complete({ ...finish, turnId: 't2', isAborted: true, reason: 'aborted' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /completed with setbacks/ }))?.text).toContain('setbacks')
  expect((await ui.find({ type: 'Text', text: /called off/ }))?.text).toContain('called off')
  await ui.press({ key: 'f-clean' })
  expect((await ui.find({ type: 'Text', text: /No missions match/ }))?.text).toContain('No missions match')
  await ui.unmount()
})

test('an empty scroll invites the first mission', async ($, on) => {
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /No missions yet/ }))?.text).toContain('No missions yet')
  await ui.unmount()
})
