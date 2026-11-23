// What the scene shows. One value, so a state that can't happen can't be written.
export type Signal =
  // Claude is busy: the working scene plays.
  | { mode: 'working' }
  // A permission ask is up but Auto mode may still settle it: keep the working scene.
  | { mode: 'asking'; askId: string }
  // Claude needs you: the needs-you scene plays; `burst` makes each time look different.
  | { mode: 'waiting'; burst: number }

declare module 'claude-code' {
  interface PluginState {
    'grand-tide': {
      signal: Signal
    }
  }
}
