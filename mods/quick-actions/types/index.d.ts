// One button: what it says, and the prompt it sends.
export type Action = {
  id: string
  icon: string
  label: string
  prompt: string
}

export type LastRun = { label: string; at: number }

declare module 'claude-code' {
  interface PluginState {
    'quick-actions': {
      // Your own buttons, mirrored from $.store so the panel redraws when they change.
      custom: Shaped<Action[]>
      // True while a turn of the main conversation is running: a press then waits its turn.
      busy: boolean
      last: LastRun | null
      // A one-line message under the buttons, such as "Saved".
      notice: string | null
    }
  }
}
