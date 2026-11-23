// Mission Scroll: a ninja-style mission log in a side panel. Each prompt you send is a
// mission; every action Claude takes for it counts toward the mission's rank (D to S),
// and a mission that finishes with no failed actions earns a star. Your own shinobi
// rank grows with the missions completed this session.

import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Filter, Mission } from '../types'
import { OUTCOME_WORDS, RANK_COLOR, actionWords, clip, clock, duration, nextRank, outcomeOf, rankOf, shinobiRank, streak } from './ranks.js'

const PANE = 'mission-scroll'
const TITLE = 'Mission scroll'
const KEEP = 200

// Change the tag when a mission's fields change: it declines what an earlier version
// stored, which outlives a reload.
const missions = atom({ plugin: 'mission-scroll', key: 'missions' } as const, [], { shape: 'missions-1' })
const orders = atom({ plugin: 'mission-scroll', key: 'orders' } as const, null)
const filter = atom({ plugin: 'mission-scroll', key: 'filter' } as const, 'all' as Filter)

const EDITS = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit'])
const COMMANDS = new Set(['Bash', 'PowerShell'])

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'clean', label: '⭐ Flawless' },
  { id: 'setbacks', label: '⚔ Setbacks' },
]

let counter = 0
const nextId = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`

// Apply a change to the mission under way, if there is one.
const onActive = (list: Mission[], change: (m: Mission) => Mission): Mission[] => {
  const i = list.length - 1
  if (i < 0 || list[i]!.outcome !== 'active') return list
  return [...list.slice(0, i), change(list[i]!)]
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'missions', description: 'Open the Mission Scroll: every prompt as a ranked ninja mission' })
    void $.ui.open({ id: PANE, title: TITLE })
    return next(e)
  })

  on('command.run', { command: 'missions' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: 'Mission Scroll opened.' }
  })

  // Your prompt becomes the next mission's orders.
  on('prompt.submit', async ($, e, next) => {
    const fromYou = (e.origin.kind === 'composer' || e.origin.kind === 'bridge') && e.isMeta !== true
    await update($, orders, () => ({ text: typeof e.text === 'string' ? e.text : '', fromYou }))
    return next(e)
  })

  // A turn of the main conversation starts a mission.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const o = await read($, orders)
      const text = (o?.text ?? e.text ?? '').trim()
      const mission: Mission = {
        id: nextId(),
        title: text === '' ? 'Standing orders' : clip(text),
        fromYou: o?.fromYou ?? false,
        startedAt: await $.clock.now(),
        actions: 0,
        edits: 0,
        commands: 0,
        setbacks: 0,
        outcome: 'active',
      }
      await update($, orders, () => null)
      // A mission left open (a turn that never reported its end) is closed as called off.
      await update($, missions, list => [...onActive(list, m => ({ ...m, outcome: 'called-off' })), mission].slice(-KEEP))
    }
    return next(e)
  })

  // Every action counts toward the mission under way, subagents' included.
  on('tool.call', async ($, e, next) => {
    const words = actionWords(e.tool, e as unknown as Record<string, unknown>)
    await update($, missions, list =>
      onActive(list, m => ({
        ...m,
        actions: m.actions + 1,
        edits: m.edits + (EDITS.has(e.tool) ? 1 : 0),
        commands: m.commands + (COMMANDS.has(e.tool) ? 1 : 0),
        last: words,
      })),
    )
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError === true) {
      await update($, missions, list => onActive(list, m => ({ ...m, setbacks: m.setbacks + 1 })))
    }
    return ran
  })

  // The main turn's end completes the mission and ranks it.
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const list = await read($, missions)
      const m = list[list.length - 1]
      if (m !== undefined && m.outcome === 'active') {
        const outcome = outcomeOf(e.reason, m.setbacks)
        await update($, missions, l => onActive(l, one => ({ ...one, outcome, ms: e.durationMs })))
        const rank = rankOf(m.actions)
        if (outcome === 'clean' && (rank === 'S' || rank === 'A')) $.ui.toast(`📜 ${rank}-rank mission complete, flawless ⭐`)
      }
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, missions)
    const f = await read($, filter)

    const done = list.filter(m => m.outcome !== 'active')
    const completed = done.filter(m => m.outcome === 'clean' || m.outcome === 'setbacks')
    const flawless = done.filter(m => m.outcome === 'clean').length
    const run = streak(list)
    const counts = (['S', 'A', 'B', 'C', 'D'] as const).map(r => ({ r, n: completed.filter(m => rankOf(m.actions) === r).length }))
    const up = nextRank(completed.length)
    const active = list[list.length - 1]?.outcome === 'active' ? list[list.length - 1] : undefined
    // Only a mission under way needs the time, for how long it has run.
    const now = active !== undefined ? await $.clock.now() : 0

    const stats = (m: Mission) =>
      `${m.actions} action${m.actions === 1 ? '' : 's'} · ${m.edits} edit${m.edits === 1 ? '' : 's'} · ${m.commands} command${m.commands === 1 ? '' : 's'}` +
      (m.setbacks > 0 ? ` · ${m.setbacks} setback${m.setbacks === 1 ? '' : 's'}` : '')

    // A small rounded label.
    const chip = (key: string, text: string, color?: string, bold = false) => (
      <Box key={key} borderStyle="round" borderColor={color ?? 'subtle'} paddingX={1}>
        <Text size="caption" color={color} weight={bold ? 'bold' : 'medium'}>{text}</Text>
      </Box>
    )
    const outcomeColor = (m: Mission) => (m.outcome === 'clean' ? 'claude' : m.outcome === 'setbacks' ? 'warning' : m.outcome === 'active' ? 'warning' : 'subtle')

    const card = (m: Mission) => {
      const rank = rankOf(m.actions)
      return (
        <Box key={m.id} flexDirection="column" borderStyle="round" borderColor={m.outcome === 'clean' ? 'claude' : 'subtle'} paddingX={1}>
          <Box flexDirection="row" alignItems="center" gap={1}>
            {chip(`rank-${m.id}`, rank, RANK_COLOR[rank], true)}
            <Box flexGrow={1} flexShrink={1}>
              <Text weight="semibold">{m.fromYou ? '' : '⚙ '}{m.title}</Text>
            </Box>
            <Text size="caption" dimColor mono>{clock(m.startedAt)}</Text>
          </Box>
          <Box flexDirection="row" flexWrap="wrap" alignItems="center" gap={1}>
            <Text size="caption" weight="semibold" color={outcomeColor(m)}>{OUTCOME_WORDS[m.outcome]}</Text>
            <Text size="caption" dimColor>{stats(m)}{m.ms !== undefined ? ` · ${duration(m.ms)}` : ''}</Text>
          </Box>
        </Box>
      )
    }

    const shown = done.filter(m => f === 'all' || (f === 'clean' ? m.outcome === 'clean' : m.outcome !== 'clean')).reverse()
    const room = Math.max(2, Math.floor(((e.viewport?.rows ?? 48) - (active ? 24 : 18)) / 4))

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text size="heading" weight="bold">📜 Mission scroll</Text>
          <Text size="caption" dimColor>Every prompt is a mission, ranked by the work it took</Text>
        </Box>

        <Box flexDirection="column" borderStyle="double" borderColor="claude" paddingX={1} gap={1}>
          <Box flexDirection="column">
            <Text size="caption" dimColor>YOUR SHINOBI RANK</Text>
            <Text size="title" weight="bold" color="claude">{shinobiRank(completed.length)}</Text>
            <Text size="caption" dimColor>{up ? `${up.left} more mission${up.left === 1 ? '' : 's'} to ${up.name}` : 'The highest rank'}</Text>
          </Box>
          <Box flexDirection="row" flexWrap="wrap" gap={1}>
            {chip('c-missions', `${completed.length} mission${completed.length === 1 ? '' : 's'}`)}
            {chip('c-flawless', `⭐ ${flawless} flawless`, flawless > 0 ? 'claude' : undefined)}
            {run >= 2 && chip('c-streak', `🔥 streak ${run}`, 'error')}
          </Box>
          <Box flexDirection="row" flexWrap="wrap" gap={1}>
            {counts.map(({ r, n }) => chip(`t-${r}`, `${r} · ${n}`, n > 0 ? RANK_COLOR[r] : undefined, n > 0))}
          </Box>
        </Box>

        {active !== undefined && (
          <Box flexDirection="column" borderStyle="round" borderColor="warning" paddingX={1}>
            <Box flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
              <Text weight="bold" color="warning">🗡 MISSION UNDER WAY</Text>
              {chip('active-rank', `rank so far ${rankOf(active.actions)}`, RANK_COLOR[rankOf(active.actions)], true)}
            </Box>
            <Text weight="semibold">{active.fromYou ? '' : '⚙ '}{active.title}</Text>
            <Text size="caption" dimColor>{stats(active)} · {duration(Math.max(0, now - active.startedAt))}</Text>
            {active.last !== undefined && <Text size="caption" mono>latest: {active.last}</Text>}
          </Box>
        )}

        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {FILTERS.map(one => (
            <Button key={`f-${one.id}`} label={one.label} variant={f === one.id ? 'primary' : 'secondary'} onPress={() => update($, filter, () => one.id)} />
          ))}
          <Button key="clear" label="Clear" variant="secondary" onPress={() => update($, missions, l => l.filter(m => m.outcome === 'active'))} />
        </Box>

        {shown.length === 0 && (
          <Box borderStyle="round" borderColor="subtle" paddingX={1} paddingY={1}>
            <Text dimColor>
              {done.length === 0 ? 'No missions yet. Send a prompt: it becomes your first mission, ranked by how much work it takes.' : 'No missions match this filter.'}
            </Text>
          </Box>
        )}
        {shown.slice(0, room).map(card)}
        <Text size="caption" dimColor>Ranks: D 0–2 actions · C 3–7 · B 8–15 · A 16–30 · S 31+</Text>
      </Box>
    )
  })
}
