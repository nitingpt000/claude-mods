// One line of the diary: a prompt you sent, or a tool call Claude made.
export type Kind = 'prompt' | 'edit' | 'command' | 'read' | 'search' | 'web' | 'agent' | 'other'

export type Status = 'running' | 'ok' | 'failed' | 'denied'

export type Entry = {
  id: string
  // When it started, in $.clock.now() milliseconds.
  at: number
  kind: Kind
  // The tool's name, or 'You' for a prompt.
  tool: string
  // What it was about: the command, the file, the pattern, the prompt's opening words.
  label: string
  // Lines added and removed, for edits and writes.
  added?: number
  removed?: number
  // True when a subagent made the call, not the main conversation.
  isSubagent?: boolean
  status: Status
  // How long it took, once it finished.
  ms?: number
}

export type Filter = 'all' | 'edits' | 'commands' | 'failures'

declare module 'claude-code' {
  interface PluginState {
    'session-diary': {
      entries: Shaped<Entry[]>
      filter: Filter
    }
  }
}
