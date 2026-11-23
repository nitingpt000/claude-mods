// Security Watch: a side panel that rates every tool call as it happens and lists the
// ones worth a look, risky in red and review in amber, with the reason in plain words.
// It only watches: every call goes on exactly as it would without the mod.

import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Alert, Filter } from '../types'
import { rate } from './rules.js'

const PANE = 'security-watch'
const TITLE = 'Security watch'
const KEEP = 300

// Change the tag when an alert's fields change: it declines what an earlier version
// stored, which outlives a reload.
const alerts = atom({ plugin: 'security-watch', key: 'alerts' } as const, [], { shape: 'alerts-1' })
const checked = atom({ plugin: 'security-watch', key: 'checked' } as const, 0)
const cwd = atom({ plugin: 'security-watch', key: 'cwd' } as const, '')
const filter = atom({ plugin: 'security-watch', key: 'filter' } as const, 'all' as Filter)

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'risky', label: 'Risky' },
  { id: 'review', label: 'Review' },
]

let counter = 0
const nextId = () => `s${Date.now().toString(36)}${(counter++).toString(36)}`

function clock(ms: number): string {
  const d = new Date(ms)
  const two = (v: number) => String(v).padStart(2, '0')
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await update($, cwd, () => e.cwd ?? '')
    await $.command.register({ name: 'security', description: 'Open Security Watch: the risky and review-worthy tool calls of this session' })
    void $.ui.open({ id: PANE, title: TITLE })
    return next(e)
  })

  on('command.run', { command: 'security' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: 'Security Watch opened.' }
  })

  on('tool.call', async ($, e, next) => {
    await update($, checked, c => c + 1)
    const verdict = rate(e.tool, e as unknown as Record<string, unknown>, (await read($, cwd)) || undefined)
    // A safe call isn't logged: it simply runs.
    if (verdict === undefined) return next(e)

    const id = e.tool_use_id ?? nextId()
    const alert: Alert = {
      id,
      at: await $.clock.now(),
      level: verdict.level,
      tool: e.tool,
      label: verdict.label,
      reason: verdict.reason,
      isSubagent: e.agentId !== undefined,
      outcome: 'running',
    }
    await update($, alerts, list => [...list, alert].slice(-KEEP))
    if (verdict.level === 'risky') $.ui.toast(`🔴 Security Watch: ${e.tool} ${verdict.reason}`)

    let outcome: Alert['outcome'] = 'failed'
    try {
      const ran = await next(e)
      outcome = ran.deny !== undefined ? 'denied' : ran.isError === true ? 'failed' : 'ran'
      return ran
    } finally {
      await update($, alerts, list => list.map(one => (one.id === id ? { ...one, outcome } : one)))
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const all = await read($, alerts)
    const f = await read($, filter)
    const total = await read($, checked)
    const risky = all.filter(a => a.level === 'risky').length
    const review = all.length - risky
    const shown = all.filter(a => f === 'all' || a.level === f)
    const room = Math.max(3, Math.floor(((e.viewport?.rows ?? 40) - 6) / 2))

    const outcome = (a: Alert) =>
      a.outcome === 'running' ? <Text color="warning"> … running</Text>
      : a.outcome === 'denied' ? <Text color="success"> ⊘ you refused it</Text>
      : a.outcome === 'failed' ? <Text dimColor> ✘ failed</Text>
      : <Text dimColor> ✔ ran</Text>

    const row = (a: Alert) => (
      <Box flexDirection="column" key={a.id}>
        <Box flexDirection="row">
          <Text dimColor mono>{clock(a.at)} </Text>
          <Text>{a.isSubagent ? '↳ ' : ''}{a.level === 'risky' ? '🔴' : '🟡'} </Text>
          <Text weight="semibold" color={a.level === 'risky' ? 'error' : 'warning'}>{a.tool} </Text>
          <Text mono>{a.label}</Text>
          {outcome(a)}
        </Box>
        <Text dimColor>{'           '}{a.reason}</Text>
      </Box>
    )

    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          {risky > 0 ? <Text weight="semibold" color="error">🔴 {risky} risky</Text> : <Text color="success">🟢 nothing risky</Text>}
          <Text color="warning"> · 🟡 {review} to review</Text>
          <Text dimColor> · {total} calls checked</Text>
        </Box>
        <Box flexDirection="row">
          {FILTERS.map(one => (
            <Button key={`f-${one.id}`} label={one.label} variant={f === one.id ? 'primary' : 'secondary'} onPress={() => update($, filter, () => one.id)} />
          ))}
          <Button key="clear" label="Clear" onPress={() => update($, alerts, () => [])} />
        </Box>
        {shown.length === 0 && (
          <Text dimColor>
            {all.length === 0
              ? 'All clear. Risky or review-worthy commands, edits and connector actions will show up here. Safe calls are checked but not listed.'
              : 'Nothing matches this filter.'}
          </Text>
        )}
        {shown.slice(-room).map(row)}
      </Box>
    )
  })
}
