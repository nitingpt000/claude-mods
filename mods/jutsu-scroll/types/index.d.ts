export type Rank = 'S' | 'A' | 'B' | 'C' | 'D'

// One jutsu: what it's called, how strong, what it costs, and the prompt it sends.
export type Jutsu = {
  id: string
  name: string
  // What it does, in plain words, under the name.
  does: string
  rank: Rank
  chakra: number
  prompt: string
}

export type LastCast = { name: string; at: number }

declare module 'claude-code' {
  interface PluginState {
    'jutsu-scroll': {
      // Your own jutsu, mirrored from $.store so the panel redraws when they change.
      custom: Shaped<Jutsu[]>
      // Casts per jutsu id, across sessions, mirrored from $.store.
      mastery: Record<string, number>
      // The session's chakra, 0 to 100. Spent by casting, restored as turns finish.
      chakra: number
      // True while a turn of the main conversation runs: a cast then waits its turn.
      busy: boolean
      last: LastCast | null
      notice: string | null
    }
  }
}
