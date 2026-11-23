// Quick Actions: a side panel of one-click buttons that send common requests to Claude.
// Press a button to send its prompt; press ✎ to put it in the prompt box to edit first.
// Your own buttons come from the prompt box ("Save the prompt box") or from
// /quick-add Label | prompt, and are kept across sessions.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Action } from '../types'
import { BUILT_IN, clock, parseAction } from './actions.js'

const PANE = 'quick-actions'
const TITLE = 'Quick actions'
const STORE_KEY = 'custom-actions'
const MAX_CUSTOM = 24

// Change the tag when an action's fields change: it declines what an earlier version
// stored, which outlives a reload.
const custom = atom({ plugin: 'quick-actions', key: 'custom' } as const, [], { shape: 'custom-1' })
const busy = atom({ plugin: 'quick-actions', key: 'busy' } as const, false)
const last = atom({ plugin: 'quick-actions', key: 'last' } as const, null)
const notice = atom({ plugin: 'quick-actions', key: 'notice' } as const, null)

let counter = 0
const nextId = () => `c${Date.now().toString(36)}${(counter++).toString(36)}`

const isAction = (v: unknown): v is Action =>
  typeof v === 'object' && v !== null && ['id', 'icon', 'label', 'prompt'].every(k => typeof (v as Record<string, unknown>)[k] === 'string')

// Your actions live in the store, which outlasts the session; the atom mirrors it.
async function saveCustom($: EngineInterface, list: Action[]) {
  await $.store.set(STORE_KEY, list)
  await update($, custom, () => list)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const saved = await $.store.get(STORE_KEY)
    await update($, custom, () => (Array.isArray(saved) ? saved.filter(isAction).slice(0, MAX_CUSTOM) : []))
    await $.command.register({ name: 'quick', description: 'Open Quick Actions: one-click buttons for common requests' })
    await $.command.register({ name: 'quick-add', description: 'Add a Quick Actions button: /quick-add Label | prompt to send' })
    void $.ui.open({ id: PANE, title: TITLE })
    return next(e)
  })

  on('command.run', { command: 'quick' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: 'Quick Actions opened.' }
  })

  on('command.run', { command: 'quick-add' }, async ($, e) => {
    const action = parseAction(e.args, nextId())
    if (action === undefined) return { text: 'Usage: /quick-add Label | the prompt to send. The label is optional.' }
    const list = await read($, custom)
    if (list.length >= MAX_CUSTOM) return { text: `You already have ${MAX_CUSTOM} buttons. Remove one with its ✕ first.` }
    await saveCustom($, [...list, action])
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: `Added "${action.label}" to Quick Actions.` }
  })

  // Track whether Claude is mid-turn, so the panel can say a press will wait its turn.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await update($, busy, () => true)
    return next(e)
  })
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) await update($, busy, () => false)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const mine = await read($, custom)
    const working = await read($, busy)
    const ran = await read($, last)
    const note = await read($, notice)

    const send = async (a: Action) => {
      await update($, notice, () => (working ? `“${a.label}” will run when Claude finishes the current turn.` : null))
      void $.prompt.submit({ text: a.prompt })
      const at = await $.clock.now()
      await update($, last, () => ({ label: a.label, at }))
    }
    const edit = async (a: Action) => {
      const done = await $.prompt.fill({ text: a.prompt })
      await update($, notice, () => (done.isFilled ? `“${a.label}” is in the prompt box: edit it, then press Enter.` : 'The prompt box is busy right now; try again in a moment.'))
    }
    const saveDraft = async () => {
      const box = await $.prompt.read()
      const action = parseAction(box.text, nextId())
      if (action === undefined) return update($, notice, () => 'Type a prompt in the prompt box first, then save it as a button.')
      if (mine.length >= MAX_CUSTOM) return update($, notice, () => `You already have ${MAX_CUSTOM} buttons. Remove one with its ✕ first.`)
      await saveCustom($, [...mine, action])
      await update($, notice, () => `Saved “${action.label}” as a button. It will be here in every session.`)
    }
    const remove = async (a: Action) => {
      await saveCustom($, mine.filter(one => one.id !== a.id))
      await update($, notice, () => `Removed “${a.label}”.`)
    }

    // A small rounded label.
    const chip = (key: string, text: string, color?: string) => (
      <Box key={key} borderStyle="round" borderColor={color ?? 'subtle'} paddingX={1}>
        <Text size="caption" color={color} weight="medium">{text}</Text>
      </Box>
    )

    const preview = (p: string) => (p.length > 70 ? `${p.slice(0, 69)}…` : p)

    // One action: the button that sends it, ✎ to edit first, ✕ for your own, and
    // the start of its prompt so you know what it will say.
    const row = (a: Action, removable: boolean) => (
      <Box key={a.id} flexDirection="column">
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Box flexGrow={1}>
            <Button key={`run-${a.id}`} label={`${a.icon} ${a.label}`} variant="secondary" onPress={() => send(a)} />
          </Box>
          <Button key={`edit-${a.id}`} label="✎ Edit" plain onPress={() => edit(a)} />
          {removable && <Button key={`del-${a.id}`} label="✕" plain onPress={() => remove(a)} />}
        </Box>
        <Text size="caption" dimColor>{preview(a.prompt)}</Text>
      </Box>
    )

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text size="heading" weight="bold">⚡ Quick actions</Text>
          <Text size="caption" dimColor>One click sends a prompt · ✎ Edit puts it in the box first</Text>
        </Box>

        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {working ? chip('busy', 'Claude is working · a press waits its turn', 'warning') : chip('ready', '● ready', 'success')}
          {ran !== null && chip('last', `Last sent: ${ran.label} at ${clock(ran.at)}`)}
        </Box>

        {note !== null && (
          <Box borderStyle="round" borderColor="claude" paddingX={1}>
            <Text size="caption" color="claude">{note}</Text>
          </Box>
        )}

        <Box flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1} gap={1}>
          <Text size="caption" weight="bold" dimColor>BUILT IN</Text>
          {BUILT_IN.map(a => row(a, false))}
        </Box>

        <Box flexDirection="column" borderStyle="round" borderColor="claude" paddingX={1} gap={1}>
          <Text size="caption" weight="bold" color="claude">YOURS · {mine.length}</Text>
          {mine.length === 0 && <Text size="caption" dimColor>None yet. Type a prompt in the box and press “Save the prompt box”, or use /quick-add Label | prompt.</Text>}
          {mine.map(a => row(a, true))}
          <Button key="save-draft" label="＋ Save the prompt box as a button" variant="primary" onPress={saveDraft} />
        </Box>
      </Box>
    )
  })
}
