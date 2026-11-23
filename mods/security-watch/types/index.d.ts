// One flagged tool call.
export type Alert = {
  id: string
  // When it started, in $.clock.now() milliseconds.
  at: number
  level: 'risky' | 'review'
  tool: string
  // The command or file, with anything that looks like a secret hidden.
  label: string
  // Why it was flagged, in plain words.
  reason: string
  // True when a subagent made the call, not the main conversation.
  isSubagent?: boolean
  // What happened: still running, ran, failed, or you refused it.
  outcome: 'running' | 'ran' | 'failed' | 'denied'
}

export type Filter = 'all' | 'risky' | 'review'

declare module 'claude-code' {
  interface PluginState {
    'security-watch': {
      alerts: Shaped<Alert[]>
      // How many calls were checked this session, flagged or not.
      checked: number
      // The session's folder, to tell what lies outside the project.
      cwd: string
      filter: Filter
    }
  }
}
