// File Heatmap: a side panel listing every file Claude read or edited this session,
// hottest first, with a heat bar (an edit counts three times a read), read and edit
// counts, lines added and removed, a 🔥 on files changed this turn, and the hottest
// folder. The @ button puts a file into the prompt box so you can ask about it.

import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Show, Sort } from '../types'
import { bar, heatColor, heatOf, hottestFolder, record, relPath, sortFiles, touchOf } from './heat.js'

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
    const room = Math.max(4, (e.viewport?.rows ?? 40) - 8)

    const mention = async (rel: string) => {
      await $.prompt.fill({ text: `@${rel} `, mode: 'insert' })
    }

    const row = (f: (typeof all)[number]) => {
      const rel = relPath(f.path, root)
      const hot = f.editedTurn !== undefined && f.editedTurn === thisTurn
      return (
        <Box key={f.path} flexDirection="row" alignItems="center">
          <Text mono color={heatColor(f, max)}>{bar(heatOf(f), max)} </Text>
          <Text mono weight={f.edits > 0 ? 'semibold' : 'regular'}>{rel}</Text>
          {hot && <Text color="error"> 🔥</Text>}
          <Text dimColor> {f.reads > 0 ? `👁${f.reads}` : ''}{f.reads > 0 && f.edits > 0 ? ' ' : ''}{f.edits > 0 ? `✏️${f.edits}` : ''}</Text>
          {f.added > 0 && <Text color="diffAdded"> +{f.added}</Text>}
          {f.removed > 0 && <Text color="diffRemoved"> −{f.removed}</Text>}
          <Button key={`at-${f.path}`} label="@" plain onPress={() => mention(rel)} />
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Text weight="semibold">🔥 {all.length} file{all.length === 1 ? '' : 's'} touched</Text>
          <Text dimColor> · {edited.length} edited · {all.length - edited.length} only read</Text>
          {(added > 0 || removed > 0) && <Text color="diffAdded"> · +{added}</Text>}
          {(added > 0 || removed > 0) && <Text color="diffRemoved"> −{removed}</Text>}
        </Box>
        {top !== undefined && (
          <Text dimColor>
            Hottest folder: <Text weight="semibold">{top.folder}</Text> ({Math.round(top.share * 100)}% of the heat)
          </Text>
        )}
        <Box flexDirection="row">
          {SORTS.map(s => (
            <Button key={`s-${s.id}`} label={s.label} variant={by === s.id ? 'primary' : 'secondary'} onPress={() => update($, sort, () => s.id)} />
          ))}
          <Button key="show" label={which === 'all' ? 'Edited only' : 'Show all'} onPress={() => update($, show, v => (v === 'all' ? 'edited' : 'all'))} />
          <Button key="clear" label="Clear" onPress={() => update($, files, () => [])} />
        </Box>
        {list.length === 0 && (
          <Text dimColor>{all.length === 0 ? 'No files yet. Files Claude reads or edits will show up here, hottest first.' : 'No edited files yet.'}</Text>
        )}
        {list.slice(0, room).map(row)}
        {list.length > room && <Text dimColor>…and {list.length - room} more</Text>}
        <Text dimColor>Heat: an edit counts 3, a read 1 · 🔥 changed this turn · @ puts the file in your prompt</Text>
      </Box>
    )
  })
}
