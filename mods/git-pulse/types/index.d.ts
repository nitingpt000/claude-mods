// One changed file, as git status and git diff report it.
export type Change = {
  path: string
  // Where it sits: staged for the next commit, changed but not staged, new and
  // untracked, or in conflict.
  area: 'staged' | 'unstaged' | 'untracked' | 'conflict'
  // M modified, A added, D deleted, R renamed, C copied, T type changed, ? untracked, U conflict.
  code: string
  added: number
  removed: number
}

export type Snapshot = {
  isRepo: boolean
  branch?: string
  isDetached?: boolean
  upstream?: string
  ahead: number
  behind: number
  changes: Change[]
  last?: { hash: string; subject: string; when: string }
  stashes: number
  // When it was read, in $.clock.now() milliseconds, and what prompted it.
  checkedAt: number
  reason: string
  error?: string
}

declare module 'claude-code' {
  interface PluginState {
    'git-pulse': {
      snapshot: Shaped<Snapshot | null>
      // A one-line message from the last fetch.
      fetchNote: string | null
      isFetching: boolean
    }
  }
}
