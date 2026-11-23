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

    // A small rounded label.
    const chip = (key: string, text: string, color?: string) => (
      <Box key={key} borderStyle="round" borderColor={color ?? 'subtle'} paddingX={1}>
        <Text size="caption" color={color} weight="medium">{text}</Text>
      </Box>
    )

    const outcome = (a: Alert) =>
      a.outcome === 'running' ? <Text size="caption" color="warning">… running</Text>
      : a.outcome === 'denied' ? <Text size="caption" color="success">⊘ you refused it</Text>
      : a.outcome === 'failed' ? <Text size="caption" dimColor>✘ failed</Text>
      : <Text size="caption" dimColor>✔ ran</Text>

    // Newest first: the latest alert is the one to look at.
    const card = (a: Alert) => {
      const color = a.level === 'risky' ? 'error' : 'warning'
      return (
        <Box key={a.id} flexDirection="column" borderStyle="round" borderColor={color} paddingX={1}>
          <Box flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
            <Box flexDirection="row" alignItems="center" gap={1}>
              {chip(`lvl-${a.id}`, a.level === 'risky' ? '🔴 RISKY' : '🟡 REVIEW', color)}
              <Text weight="semibold">{a.isSubagent ? '↳ ' : ''}{a.tool}</Text>
            </Box>
            <Text size="caption" dimColor mono>{clock(a.at)}</Text>
          </Box>
          <Text mono>{a.label}</Text>
          <Box flexDirection="row" justifyContent="space-between" gap={1}>
            <Text size="caption" dimColor>{a.reason}</Text>
            {outcome(a)}
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text size="heading" weight="bold">🛡️ Security watch</Text>
          <Text size="caption" dimColor>Risky and review-worthy tool calls · it watches, never blocks</Text>
        </Box>

        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {risky > 0 ? chip('c-risky', `🔴 ${risky} risky`, 'error') : chip('c-safe', '🟢 nothing risky', 'success')}
          {chip('c-review', `🟡 ${review} to review`, review > 0 ? 'warning' : undefined)}
          {chip('c-checked', `${total} calls checked`)}
        </Box>

        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {FILTERS.map(one => (
            <Button key={`f-${one.id}`} label={one.label} variant={f === one.id ? 'primary' : 'secondary'} onPress={() => update($, filter, () => one.id)} />
          ))}
          <Button key="clear" label="Clear" variant="secondary" onPress={() => update($, alerts, () => [])} />
        </Box>

        {shown.length === 0 && (
          <Box borderStyle="round" borderColor={all.length === 0 ? 'success' : 'subtle'} paddingX={1} paddingY={1}>
            <Text dimColor>
              {all.length === 0
                ? 'All clear. Risky or review-worthy commands, edits and connector actions will show up here. Safe calls are checked but not listed.'
                : 'Nothing matches this filter.'}
            </Text>
          </Box>
        )}
        {shown.slice(-Math.max(2, Math.floor(room / 2))).reverse().map(card)}
      </Box>
    )
  })
}
