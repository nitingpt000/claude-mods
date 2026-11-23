// Turns Claude Code events into scene changes, and draws the scene as the backdrop.

import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { LOOK, SCENE_NAME, UNPAINTABLE } from './look.js'
import { altFor, sceneFor } from './scene.js'
import { INITIAL, transition, type SignalEvent } from './state.js'

// How long a permission ask waits unanswered before Claude needs you. Auto mode settles
// most asks sooner, so it doesn't flicker the scene.
const ASK_DELAY_MS = 1500

const seed = () => Math.floor(Math.random() * 2 ** 31)

const signal = atom({ plugin: 'grand-tide', key: 'signal' } as const, INITIAL)

type Engine = Parameters<typeof read>[0]

// An event that changes nothing writes nothing, so tool calls don't redraw the scene.
async function send(engine: Engine, event: SignalEvent) {
  const before = await read(engine, signal)
  if (transition(before, event) === before) return
  await update(engine, signal, state => transition(state, event))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    if (UNPAINTABLE !== undefined) $.ui.toast(UNPAINTABLE)
    await $.theme.set(LOOK)
    return next(e)
  })

  // Only the main agent counts: a background subagent says nothing about you.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await send($, { type: 'turnStarted' })
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) await send($, { type: 'turnEnded', seed: seed() })
    return next(e)
  })

  // A permission prompt for you: wait a moment, then ignite if it's still open.
  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    const askId = e.tool_use_id
    const asksYou = e.approver === 'person' && verdict.decision === 'ask'
    const fromClaude = e.agentId === undefined && next.origin.plugin === 'engine'
    if (askId !== undefined && fromClaude && asksYou) {
      await send($, { type: 'askRaised', askId })
      $.clock.after(ASK_DELAY_MS, () => {
        send($, { type: 'askUnanswered', askId, seed: seed() }).catch(() => {})
      })
    }
    return verdict
  })

  // A question to you shows the needs-you scene until you answer; any other tool means work again.
  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined || next.origin.plugin !== 'engine') return next(e)
    const question = e.tool === 'AskUserQuestion'
    if (question) await send($, { type: 'questionOpened', seed: seed() })
    const result = await next(e)
    await send($, { type: question ? 'questionAnswered' : 'toolRan' })
    return result
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') return next(e)
    if (e.props.plugin !== $.plugin.name || e.props.scene !== SCENE_NAME) return next(e)
    const now = await read($, signal)
    const { Svg } = $.ui.resolve(e)
    return <Svg source={sceneFor(now)} alt={altFor(now)} isInteractive />
  })
}
