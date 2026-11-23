// What Claude did to one file this session.
export type FileHeat = {
  // The full path, as the tool was given it.
  path: string
  reads: number
  edits: number
  // Lines added and removed across all edits.
  added: number
  removed: number
  // When it was last touched, in $.clock.now() milliseconds.
  lastAt: number
  // The turn it was last edited in, to mark files changed this turn.
  editedTurn?: number
}

export type Sort = 'hot' | 'recent' | 'name'
export type Show = 'all' | 'edited'

declare module 'claude-code' {
  interface PluginState {
    'file-heatmap': {
      files: Shaped<FileHeat[]>
      // The session's folder, to show paths relative to the project.
      cwd: string
      // Counts the main conversation's turns, for "changed this turn".
      turn: number
      sort: Sort
      show: Show
    }
  }
}
