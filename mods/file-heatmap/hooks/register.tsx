// File Heatmap: a side panel listing every file Claude read or edited this session,
// hottest first, with a heat bar (an edit counts three times a read), read and edit
// counts, lines added and removed, a 🔥 on files changed this turn, and the hottest
// folder. The @ button puts a file into the prompt box so you can ask about it.

import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Show, Sort } from '../types'
import { heatColor, heatOf, hottestFolder, record, relPath, sortFiles, touchOf } from './heat.js'

const PANE = 'file-heatmap'
const TITLE = 'File heatmap'
const KEEP = 500

// Change the tag when a row's fields change: it declines what an earlier version
// stored, which outlives a reload.
const files = atom({ plugin: 'file-heatmap', key: 'files' } as const, [], { shape: 'files-1' })
const cwd = atom({ plugin: 'file-heatmap', key: 'cwd' } as const, '')
const turn = atom({ plugin: 'file-heatmap', key: 'turn' } as const, 0)
const sort = atom({ plugin: 'file-heatmap', key: 'sort' } as const, 'hot' as Sort)
const show = atom({ plugin: 'file-heatmap', key: 'show' } as const, 'all' as Show)

const SORTS: { id: Sort; label: string }[] = [
  { id: 'hot', label: 'Hottest' },
  { id: 'recent', label: 'Recent' },
  { id: 'name', label: 'Name' },
]

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await update($, cwd, () => e.cwd ?? '')
    await $.command.register({ name: 'heatmap', description: 'Open the File Heatmap: every file Claude touched, hottest first' })
    void $.ui.open({ id: PANE, title: TITLE })
    return next(e)
  })

  on('command.run', { command: 'heatmap' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: 'File Heatmap opened.' }
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await update($, turn, t => t + 1)
    return next(e)
  })

  // Only reads and edits that went through count: a refused or failed call left the file alone.
  on('tool.call', async ($, e, next) => {
    const t = touchOf(e.tool, e as unknown as Record<string, unknown>)
    const ran = await next(e)
    if (t !== undefined && ran.deny === undefined && ran.isError !== true) {
      const at = await $.clock.now()
      const now = await read($, turn)
      await update($, files, list => record(list, t, at, now).slice(-KEEP))
    }
    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const all = await read($, files)
    const root = await read($, cwd)
    const thisTurn = await read($, turn)
    const by = await read($, sort)
    const which = await read($, show)

    const edited = all.filter(f => f.edits > 0)
    const added = all.reduce((s, f) => s + f.added, 0)
    const removed = all.reduce((s, f) => s + f.removed, 0)
    const top = hottestFolder(all, root)
    const max = Math.max(0, ...all.map(heatOf))
    const list = sortFiles(which === 'edited' ? edited : all, by, root)
    // Each card takes about five rows; keep the header and controls in view.
    const room = Math.max(3, Math.floor(((e.viewport?.rows ?? 48) - 10) / 5))

    const mention = async (rel: string) => {
      await $.prompt.fill({ text: `@${rel} `, mode: 'insert' })
    }

    // A small rounded label, for the header's figures and a card's "this turn".
    const chip = (key: string, text: string, color?: string) => (
      <Box key={key} borderStyle="round" borderColor={color ?? 'subtle'} paddingX={1}>
        <Text size="caption" color={color} weight="medium">{text}</Text>
      </Box>
    )

    const card = (f: (typeof all)[number]) => {
      const rel = relPath(f.path, root)
      const cut = rel.lastIndexOf('/')
      const name = cut >= 0 ? rel.slice(cut + 1) : rel
      const folder = cut >= 0 ? rel.slice(0, cut) : '.'
      const hot = f.editedTurn !== undefined && f.editedTurn === thisTurn
      const heat = heatOf(f)
      const color = heatColor(f, max)
      return (
        <Box key={f.path} flexDirection="column" borderStyle="round" borderColor={hot ? 'error' : 'subtle'} paddingX={1}>
          <Box flexDirection="row" justifyContent="space-between" alignItems="center">
            <Box flexDirection="row" alignItems="center" gap={1}>
              <Text weight="semibold" mono>{name}</Text>
              {hot && chip(`hot-${f.path}`, '🔥 this turn', 'error')}
            </Box>
            <Button key={`at-${f.path}`} label="@ Mention" plain onPress={() => mention(rel)} />
          </Box>
          <Text size="caption" dimColor mono>{folder}</Text>
          {/* The heat bar: a track with a fill sized to this file's share of the hottest. */}
          <Box key={`track-${f.path}`} flexDirection="row" width="100%" backgroundColor="inactive">
            <Box key={`bar-${f.path}`} width={`${Math.max(3, Math.round((heat / Math.max(1, max)) * 100))}%`} backgroundColor={color}>
              <Text size="caption"> </Text>
            </Box>
          </Box>
          <Box flexDirection="row" gap={1}>
            <Text size="caption" dimColor>
              {f.reads > 0 ? `👁 ${f.reads} read${f.reads === 1 ? '' : 's'}` : ''}
              {f.reads > 0 && f.edits > 0 ? ' · ' : ''}
              {f.edits > 0 ? `✏️ ${f.edits} edit${f.edits === 1 ? '' : 's'}` : ''}
            </Text>
            {f.added > 0 && <Text size="caption" color="diffAdded">+{f.added}</Text>}
            {f.removed > 0 && <Text size="caption" color="diffRemoved">−{f.removed}</Text>}
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text size="heading" weight="bold">🔥 File heatmap</Text>
          {top !== undefined ? (
            <Text size="caption" dimColor>
              Hottest folder: {top.folder} · {Math.round(top.share * 100)}% of the heat
            </Text>
          ) : (
            <Text size="caption" dimColor>Every file Claude reads or edits, hottest first</Text>
          )}
        </Box>

        {all.length > 0 && (
          <Box flexDirection="row" flexWrap="wrap" gap={1}>
            {chip('c-files', `${all.length} file${all.length === 1 ? '' : 's'}`)}
            {chip('c-edited', `✏️ ${edited.length} edited`, edited.length > 0 ? 'warning' : undefined)}
            {chip('c-read', `👁 ${all.length - edited.length} read only`)}
            {(added > 0 || removed > 0) && chip('c-plus', `+${added}`, 'diffAdded')}
            {(added > 0 || removed > 0) && chip('c-minus', `−${removed}`, 'diffRemoved')}
          </Box>
        )}

        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {SORTS.map(s => (
            <Button key={`s-${s.id}`} label={s.label} variant={by === s.id ? 'primary' : 'secondary'} onPress={() => update($, sort, () => s.id)} />
          ))}
          <Button key="show" label={which === 'all' ? 'Edited only' : 'Show all'} variant="secondary" onPress={() => update($, show, v => (v === 'all' ? 'edited' : 'all'))} />
          <Button key="clear" label="Clear" variant="secondary" onPress={() => update($, files, () => [])} />
        </Box>

        {list.length === 0 && (
          <Box borderStyle="round" borderColor="subtle" paddingX={1} paddingY={1}>
            <Text dimColor>{all.length === 0 ? 'No files yet. Files Claude reads or edits will show up here, hottest first.' : 'No edited files yet.'}</Text>
          </Box>
        )}
        {list.slice(0, room).map(card)}
        {list.length > room && <Text size="caption" dimColor>…and {list.length - room} more</Text>}

        <Text size="caption" dimColor>Heat: an edit counts 3, a read 1 · 🔥 changed this turn · @ Mention puts the file in your prompt</Text>
      </Box>
    )
  })
}
