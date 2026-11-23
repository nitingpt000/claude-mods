// The scene's state machine, pure. The hooks turn Claude Code events into these events.
//
//   working ──turnEnded / questionOpened──────────▶ waiting
//   working ──askRaised──▶ asking ──askUnanswered──▶ waiting
//   asking / waiting ──turnStarted / questionAnswered / toolRan──▶ working

import type { Signal } from '../types'

export type SignalEvent =
  | { type: 'turnStarted' }
  | { type: 'turnEnded'; seed: number }
  | { type: 'questionOpened'; seed: number }
  | { type: 'questionAnswered' }
  | { type: 'askRaised'; askId: string }
  | { type: 'askUnanswered'; askId: string; seed: number }
  | { type: 'toolRan' }

const WORKING: Signal = { mode: 'working' }

// Desktop loads the mod with your first message, so a session starts in a turn.
export const INITIAL: Signal = WORKING

// Already waiting keeps its burst, so a repeat doesn't replay the opening.
function wait(state: Signal, seed: number): Signal {
  return state.mode === 'waiting' ? state : { mode: 'waiting', burst: seed }
}

export function transition(state: Signal, event: SignalEvent): Signal {
  switch (event.type) {
    case 'turnStarted':
    case 'questionAnswered':
    case 'toolRan':
      return state.mode === 'working' ? state : WORKING
    case 'turnEnded':
    case 'questionOpened':
      return wait(state, event.seed)
    case 'askRaised':
      return state.mode === 'working' ? { mode: 'asking', askId: event.askId } : state
    case 'askUnanswered':
      // Only the ask that started the wait can end it; a stale timer does nothing.
      return state.mode === 'asking' && state.askId === event.askId ? wait(state, event.seed) : state
  }
}
