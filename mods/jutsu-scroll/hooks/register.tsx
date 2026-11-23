// Jutsu Scroll: Quick Actions as a ninja's scroll. Each jutsu is a one-click prompt with
// a rank, a chakra cost, three hand signs and a mastery level that grows as you cast
// it. Casting spends chakra and finished turns restore it, but chakra is flavor only:
// a cast is never refused. ⚡ Cast sends the prompt; ✎ Prepare puts it in the prompt
// box first. Forge your own from the prompt box, or with /jutsu-add Name | prompt.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Jutsu } from '../types'
import { BUILT_IN, CHAKRA_MAX, CHAKRA_REGEN, MASTERY_TITLES, RANK_COLOR, chakraWord, clock, forge, handSigns, masteryLevel, masteryStars, regen, spend } from './jutsu.js'

const PANE = 'jutsu-scroll'
const TITLE = 'Jutsu scroll'
const CUSTOM_KEY = 'custom-jutsu'
const MASTERY_KEY = 'mastery'
const MAX_CUSTOM = 24

// Change the tag when a jutsu's fields change: it declines what an earlier version
// stored, which outlives a reload.
const custom = atom({ plugin: 'jutsu-scroll', key: 'custom' } as const, [], { shape: 'custom-1' })
const mastery = atom({ plugin: 'jutsu-scroll', key: 'mastery' } as const, {})
const chakra = atom({ plugin: 'jutsu-scroll', key: 'chakra' } as const, CHAKRA_MAX)
const busy = atom({ plugin: 'jutsu-scroll', key: 'busy' } as const, false)
const last = atom({ plugin: 'jutsu-scroll', key: 'last' } as const, null)
const notice = atom({ plugin: 'jutsu-scroll', key: 'notice' } as const, null)

let counter = 0
const nextId = () => `j${Date.now().toString(36)}${(counter++).toString(36)}`

const isJutsu = (v: unknown): v is Jutsu =>
  typeof v === 'object' && v !== null &&
  ['id', 'name', 'does', 'rank', 'prompt'].every(k => typeof (v as Record<string, unknown>)[k] === 'string') &&
  typeof (v as Record<string, unknown>).chakra === 'number'

// Your jutsu and your mastery live in the store, which outlasts the session.
async function saveCustom($: EngineInterface, list: Jutsu[]) {
  await $.store.set(CUSTOM_KEY, list)
  await update($, custom, () => list)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const saved = await $.store.get(CUSTOM_KEY)
    await update($, custom, () => (Array.isArray(saved) ? saved.filter(isJutsu).slice(0, MAX_CUSTOM) : []))
    const m = await $.store.get(MASTERY_KEY)
    await update($, mastery, () =>
      typeof m === 'object' && m !== null && !Array.isArray(m)
        ? Object.fromEntries(Object.entries(m).filter(([, v]) => typeof v === 'number')) as Record<string, number>
        : {},
    )
    await $.command.register({ name: 'jutsu', description: 'Open the Jutsu Scroll: one-click prompts as ninja techniques' })
    await $.command.register({ name: 'jutsu-add', description: 'Forge a jutsu: /jutsu-add Name | the prompt it sends' })
    void $.ui.open({ id: PANE, title: TITLE })
    return next(e)
  })

  on('command.run', { command: 'jutsu' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: 'Jutsu Scroll opened.' }
  })

  on('command.run', { command: 'jutsu-add' }, async ($, e) => {
    const j = forge(e.args, nextId())
    if (j === undefined) return { text: 'Usage: /jutsu-add Name | the prompt to send. The name is optional.' }
    const list = await read($, custom)
    if (list.length >= MAX_CUSTOM) return { text: `Your scroll holds ${MAX_CUSTOM} jutsu. Remove one with its ✕ first.` }
    await saveCustom($, [...list, j])
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: `Forged "${j.name}", a ${j.rank}-rank jutsu.` }
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await update($, busy, () => true)
    return next(e)
  })

  // A finished turn restores chakra.
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, busy, () => false)
      await update($, chakra, c => regen(c))
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const mine = await read($, custom)
    const casts = await read($, mastery)
    const power = await read($, chakra)
    const working = await read($, busy)
    const lastCast = await read($, last)
    const note = await read($, notice)

    const cast = async (j: Jutsu) => {
      const before = await read($, chakra)
      void $.prompt.submit({ text: j.prompt })
      await update($, chakra, c => spend(c, j.chakra))
      const count = (casts[j.id] ?? 0) + 1
      const next = { ...casts, [j.id]: count }
      await $.store.set(MASTERY_KEY, next)
      await update($, mastery, () => next)
      const at = await $.clock.now()
      await update($, last, () => ({ name: j.name, at }))
      const levelUp = masteryLevel(count) > masteryLevel(count - 1)
      await update($, notice, () =>
        working ? `${j.name} is ready: it will strike when Claude finishes the current turn.`
        : before < j.chakra ? `${j.name} cast on fumes. It still works: chakra is only for show.`
        : levelUp ? `${j.name} mastery rose to ${MASTERY_TITLES[masteryLevel(count)]}!`
        : null,
      )
    }
    const prepare = async (j: Jutsu) => {
      const done = await $.prompt.fill({ text: j.prompt })
      await update($, notice, () => (done.isFilled ? `${j.name} is prepared in the prompt box: adjust it, then press Enter.` : 'The prompt box is busy right now; try again in a moment.'))
    }
    const forgeDraft = async () => {
      const box = await $.prompt.read()
      const j = forge(box.text, nextId())
      if (j === undefined) return update($, notice, () => 'Write the jutsu in the prompt box first, then forge it.')
      if (mine.length >= MAX_CUSTOM) return update($, notice, () => `Your scroll holds ${MAX_CUSTOM} jutsu. Remove one with its ✕ first.`)
      await saveCustom($, [...mine, j])
      await update($, notice, () => `Forged “${j.name}”, a ${j.rank}-rank jutsu. It stays in your scroll for every session.`)
    }
    const remove = async (j: Jutsu) => {
      await saveCustom($, mine.filter(one => one.id !== j.id))
      await update($, notice, () => `“${j.name}” was struck from the scroll.`)
    }

    const chip = (key: string, text: string, color?: string, bold = false) => (
      <Box key={key} borderStyle="round" borderColor={color ?? 'subtle'} paddingX={1}>
        <Text size="caption" color={color} weight={bold ? 'bold' : 'medium'}>{text}</Text>
      </Box>
    )

    const preview = (p: string) => (p.length > 68 ? `${p.slice(0, 67)}…` : p)

    const card = (j: Jutsu, removable: boolean) => {
      const n = casts[j.id] ?? 0
      return (
        <Box key={j.id} flexDirection="column" borderStyle="round" borderColor={RANK_COLOR[j.rank]} paddingX={1}>
          <Box flexDirection="row" alignItems="center" gap={1}>
            {chip(`rank-${j.id}`, j.rank, RANK_COLOR[j.rank], true)}
            <Box flexDirection="column" flexGrow={1} flexShrink={1}>
              <Text weight="bold">{j.name}</Text>
              <Text size="caption" dimColor>{j.does}</Text>
            </Box>
            {chip(`cost-${j.id}`, `🌀 ${j.chakra}`, 'claude')}
          </Box>
          <Box flexDirection="row" justifyContent="space-between" gap={1}>
            <Text size="caption">{handSigns(j.id)}</Text>
            <Text size="caption" color={n > 0 ? 'claude' : 'subtle'}>{masteryStars(n)}{n > 0 ? ` · cast ${n}×` : ''}</Text>
          </Box>
          <Text size="caption" dimColor>{preview(j.prompt)}</Text>
          <Box flexDirection="row" gap={1}>
            <Button key={`cast-${j.id}`} label="⚡ Cast" variant="primary" onPress={() => cast(j)} />
            <Button key={`prep-${j.id}`} label="✎ Prepare" plain onPress={() => prepare(j)} />
            {removable && <Button key={`del-${j.id}`} label="✕" plain onPress={() => remove(j)} />}
          </Box>
        </Box>
      )
    }

    const { word, color } = chakraWord(power)
    const pct = Math.round((power / CHAKRA_MAX) * 100)
    const totalCasts = Object.values(casts).reduce((s, v) => s + v, 0)

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text size="heading" weight="bold">🥷 Jutsu scroll</Text>
          <Text size="caption" dimColor>Cast a technique to send its prompt · Prepare to adjust it first</Text>
        </Box>

        <Box flexDirection="column" borderStyle="double" borderColor="claude" paddingX={1}>
          <Box flexDirection="row" justifyContent="space-between" alignItems="center">
            <Text size="caption" dimColor>CHAKRA</Text>
            <Text size="caption" weight="bold" color={color}>{power} / {CHAKRA_MAX} · {word}</Text>
          </Box>
          <Box key="chakra-track" flexDirection="row" width="100%" backgroundColor="inactive">
            <Box key="chakra-bar" width={`${Math.max(power > 0 ? 3 : 0, pct)}%`} backgroundColor={color}>
              <Text size="caption"> </Text>
            </Box>
          </Box>
          <Text size="caption" dimColor>Each finished turn restores {CHAKRA_REGEN} · chakra is for show and never stops a cast</Text>
        </Box>

        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {working ? chip('busy', '⚔ Claude is in battle · casts wait their turn', 'warning') : chip('ready', '● ready to cast', 'success')}
          {lastCast !== null && chip('last', `Last cast: ${lastCast.name} at ${clock(lastCast.at)}`)}
          {totalCasts > 0 && chip('total', `${totalCasts} cast${totalCasts === 1 ? '' : 's'} in all`)}
        </Box>

        {note !== null && (
          <Box borderStyle="round" borderColor="claude" paddingX={1}>
            <Text size="caption" color="claude">{note}</Text>
          </Box>
        )}

        <Text size="caption" weight="bold" dimColor>TECHNIQUES OF THE SCROLL</Text>
        {BUILT_IN.map(j => card(j, false))}

        <Text size="caption" weight="bold" color="claude">YOUR JUTSU · {mine.length}</Text>
        {mine.length === 0 && (
          <Box borderStyle="round" borderColor="subtle" paddingX={1}>
            <Text size="caption" dimColor>None forged yet. Write a prompt in the box and press “Forge a jutsu”, or use /jutsu-add Name | prompt.</Text>
          </Box>
        )}
        {mine.map(j => card(j, true))}
        <Button key="forge" label="🔨 Forge a jutsu from the prompt box" variant="primary" onPress={forgeDraft} />

        <Text size="caption" dimColor>Ranks D to S · 🌀 chakra cost · ★ mastery grows at 1, 3, 6, 10 and 15 casts</Text>
      </Box>
    )
  })
}
