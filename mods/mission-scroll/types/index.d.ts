// How a mission ended: still under way, done with no failed actions, done with some,
// called off by you, ended by an error, or declined by the model.
export type Outcome = 'active' | 'clean' | 'setbacks' | 'called-off' | 'failed' | 'declined'

// One mission: everything Claude did for one prompt.
export type Mission = {
  id: string
  // The orders: the opening words of your prompt.
  title: string
  // False when an automated prompt (a background task's notice) started it.
  fromYou: boolean
  startedAt: number
  // How long the turn took, once it ended.
  ms?: number
  // Tool calls made, and how many were edits, commands, or failed.
  actions: number
  edits: number
  commands: number
  setbacks: number
  // The newest action, in a few words.
  last?: string
  outcome: Outcome
}

export type Orders = { text: string; fromYou: boolean }

export type Filter = 'all' | 'clean' | 'setbacks'

declare module 'claude-code' {
  interface PluginState {
    'mission-scroll': {
      missions: Shaped<Mission[]>
      // The prompt waiting to become the next mission's orders.
      orders: Orders | null
      filter: Filter
    }
  }
}
