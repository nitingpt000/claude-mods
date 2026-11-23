// Session Diary: a side panel with a live timeline of the session. Each prompt you send
// starts a new section; each tool call Claude makes adds a line that shows the time,
// what it touched, how long it took, and whether it worked.

import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Entry, Filter, Kind } from '../types'
import { clip, clock, describe, duration } from './describe.js'

const PANE = 'session-diary'
const TITLE = 'Session diary'
// Keep the newest entries; older ones fall off the top.
const KEEP = 400

// Change the tag when an entry's fields change: it declines what an earlier version
// stored, which outlives a reload.
const entries = atom({ plugin: 'session-diary', key: 'entries' } as const, [], { shape: 'entries-1' })
const filter = atom({ plugin: 'session-diary', key: 'filter' } as const, 'all' as Filter)

const ICON: Record<Kind, string> = {
  prompt: '💬',
  edit: '✏️',
  command: '▶',
  read: '📄',
  search: '🔎',
  web: '🌐',
  agent: '🤖',
  other: '🧩',
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'edits', label: 'Edits' },
  { id: 'commands', label: 'Commands' },
  { id: 'failures', label: 'Failures' },
]

function shows(f: Filter, e: Entry): boolean {
  if (f === 'all') return true
  if (e.kind === 'prompt') return true
  if (f === 'edits') return e.kind === 'edit'
  if (f === 'commands') return e.kind === 'command'
  return e.status === 'failed' || e.status === 'denied'
}

let counter = 0
const nextId = () => `d${Date.now().toString(36)}${(counter++).toString(36)}`

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'diary', description: 'Open the session diary: a live timeline of what Claude did' })
    void $.ui.open({ id: PANE, title: TITLE })
    return next(e)
  })

  on('command.run', { command: 'diary' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: 'Session diary opened.' }
  })

  // Each prompt you send starts a new section of the diary. Automated prompts (a
  // background task's notice, a scheduled trigger) are not yours, so they're left out.
  on('prompt.submit', async ($, e, next) => {
    const at = await $.clock.now()
    const said = typeof e.text === 'string' ? e.text : ''
    const fromYou = e.origin.kind === 'composer' || e.origin.kind === 'bridge'
    if (fromYou && e.isMeta !== true && said.trim() !== '') {
      const entry: Entry = { id: nextId(), at, kind: 'prompt', tool: 'You', label: clip(said, 80), status: 'ok' }
      await update($, entries, list => [...list, entry].slice(-KEEP))
    }
    return next(e)
  })

  // Every tool call: a line when it starts, filled in when it finishes.
  on('tool.call', async ($, e, next) => {
    const at = await $.clock.now()
    const what = describe(e.tool, e as unknown as Record<string, unknown>)
    const id = e.tool_use_id ?? nextId()
    const entry: Entry = { id, at, tool: e.tool, ...what, isSubagent: e.agentId !== undefined, status: 'running' }
    await update($, entries, list => [...list, entry].slice(-KEEP))

    let status: Entry['status'] = 'failed'
    try {
      const ran = await next(e)
      status = ran.deny !== undefined ? 'denied' : ran.isError === true ? 'failed' : 'ok'
      return ran
    } finally {
      const ms = Math.max(0, (await $.clock.now()) - at)
      await update($, entries, list => list.map(one => (one.id === id ? { ...one, status, ms } : one)))
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const all = await read($, entries)
    const f = await read($, filter)
    const calls = all.filter(x => x.kind !== 'prompt')
    const edits = calls.filter(x => x.kind === 'edit').length
    const commands = calls.filter(x => x.kind === 'command').length
    const failed = calls.filter(x => x.status === 'failed' || x.status === 'denied').length
    const running = calls.filter(x => x.status === 'running').length

    const shown = all.filter(x => shows(f, x))
    // Drop a prompt line whose section shows nothing under the current filter.
    const visible = shown.filter((x, i) => x.kind !== 'prompt' || f === 'all' || (shown[i + 1] !== undefined && shown[i + 1]!.kind !== 'prompt'))
    const room = Math.max(4, (e.viewport?.rows ?? 40) - 6)

    const row = (x: Entry) => {
      if (x.kind === 'prompt') {
        return (
          <Box flexDirection="row" key={x.id}>
            <Text dimColor mono>{clock(x.at)} </Text>
            <Text weight="semibold" color="claude">{ICON.prompt} {x.label}</Text>
          </Box>
        )
      }
      const state =
        x.status === 'running' ? <Text color="warning"> … running</Text>
        : x.status === 'failed' ? <Text color="error"> ✘ failed{x.ms !== undefined ? ` ${duration(x.ms)}` : ''}</Text>
        : x.status === 'denied' ? <Text color="error"> ⊘ denied</Text>
        : <Text color="success"> ✔{x.ms !== undefined && x.ms >= 1000 ? ` ${duration(x.ms)}` : ''}</Text>
      return (
        <Box flexDirection="row" key={x.id}>
          <Text dimColor mono>{clock(x.at)} </Text>
          <Text>{x.isSubagent ? '  ↳ ' : '  '}{ICON[x.kind]} </Text>
          <Text weight="semibold" color={x.status === 'failed' || x.status === 'denied' ? 'error' : undefined}>{x.tool} </Text>
          <Text mono={x.kind === 'command' || x.kind === 'edit' || x.kind === 'read'}>{x.label}</Text>
          {x.added !== undefined && x.added > 0 && <Text color="diffAdded"> +{x.added}</Text>}
          {x.removed !== undefined && x.removed > 0 && <Text color="diffRemoved"> −{x.removed}</Text>}
          {state}
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Text weight="semibold">{calls.length} calls</Text>
          <Text dimColor> · {edits} edits · {commands} commands</Text>
          {failed > 0 ? <Text color="error"> · {failed} failed</Text> : <Text color="success"> · none failed</Text>}
          {running > 0 && <Text color="warning"> · {running} running</Text>}
        </Box>
        <Box flexDirection="row">
          {FILTERS.map(one => (
            <Button key={`f-${one.id}`} label={one.label} variant={f === one.id ? 'primary' : 'secondary'} onPress={() => update($, filter, () => one.id)} />
          ))}
          <Button key="clear" label="Clear" onPress={() => update($, entries, () => [])} />
        </Box>
        {visible.length === 0 && <Text dimColor>{all.length === 0 ? 'Nothing yet. Claude’s commands and edits will show up here as they happen.' : 'Nothing matches this filter.'}</Text>}
        {visible.slice(-room).map(row)}
      </Box>
    )
  })
}
