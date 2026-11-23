// The backdrop: a hidden village at dusk, all original vector art.
//
// While Claude works: leaves fall, lanterns sway, clouds drift, windows flicker and a
// shinobi leaps across the rooftops now and then.
// When Claude needs you: the sky burns red, a seal ignites in the upper right with
// leaves whirling around it, a shuriken strikes its ring, and the shinobi waits on the
// watchtower with a scarf in the wind.
//
// Desktop draws it in a sandboxed frame: CSS animation only, no script. Moving parts use
// translate/rotate keyframes with keyword easing, no fill-mode, and each one's resting
// place is in the plain markup so reduced motion still shows a finished picture.

import type { Signal } from '../types'

type Random = { next: () => number; pick: (min: number, max: number) => number }

// mulberry32: the same seed always draws the same scene.
function seeded(seed: number): Random {
  let t = seed >>> 0
  const next = () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
  return { next, pick: (min, max) => min + next() * (max - min) }
}

const n = (v: number) => Math.round(v * 10) / 10

// The chat column: keep the busy art out of it.
const CHAT = { left: 440, right: 1160 }
const MOON = { x: 250, y: 165 }
const SEAL = { x: 1310, y: 320 }
const TOWER = { x: 1435, top: 700 }

const INK = '#0b0710'
const LEAF = 'M0,-9C6,-5 6,4 0,9C-6,4 -6,-5 0,-9Z'
const LEAF_COLORS = ['#5f9e4a', '#7cb357', '#4b8a3c', '#d9822b', '#e0a23a', '#9cc25a']
const SHURIKEN = 'M0,-22L5,-5L22,0L5,5L0,22L-5,5L-22,0L-5,-5Z'

// A shinobi mid-stride, facing right, feet at 0,0.
const RUNNER =
  'M3,-30L12,-27L19,-19L15,-17L10,-22L8,-14L17,-6L21,0L16,1L10,-4L3,-9L-4,-2L-11,0L-12,-4L-7,-6L-2,-14L-3,-22L-10,-17L-13,-20L-4,-28Z'
// Standing watch, feet at 0,0.
const STANDER = 'M-7,-31L7,-31L9,-15L6,0L1.5,0L0,-13L-1.5,0L-6,0L-9,-15Z'

// ---------- still layers ----------

function sky(waiting: boolean): string {
  const stops = waiting
    ? ['#12060f', '#3a0d1e', '#7a1a24', '#d0402a', '#f0702e', '#f59a48']
    : ['#0f0b22', '#2b1840', '#6b2a45', '#c4552f', '#f08c3c', '#f6b25a']
  const at = [0, 0.36, 0.6, 0.79, 0.9, 1]
  return (
    '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">' +
    stops.map((c, i) => `<stop offset="${at[i]}" stop-color="${c}"/>`).join('') +
    '</linearGradient>'
  )
}

const DEFS =
  '<radialGradient id="moonhalo"><stop offset="0.3" stop-color="#ffe9c4" stop-opacity="0.35"/><stop offset="1" stop-color="#ffe9c4" stop-opacity="0"/></radialGradient>' +
  '<radialGradient id="lampglow"><stop offset="0" stop-color="#ff8a3a" stop-opacity="0.55"/><stop offset="1" stop-color="#ff8a3a" stop-opacity="0"/></radialGradient>' +
  '<radialGradient id="sealglow"><stop offset="0.2" stop-color="#ff7a2a" stop-opacity="0.5"/><stop offset="1" stop-color="#ff7a2a" stop-opacity="0"/></radialGradient>' +
  '<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6b25a" stop-opacity="0"/><stop offset="1" stop-color="#f6b25a" stop-opacity="0.22"/></linearGradient>' +
  `<path id="leaf" d="${LEAF}"/>`

function moon(): string {
  return (
    `<circle cx="${MOON.x}" cy="${MOON.y}" r="190" fill="url(#moonhalo)"/>` +
    `<circle cx="${MOON.x}" cy="${MOON.y}" r="72" fill="#f7e6c4"/>` +
    `<circle cx="${MOON.x - 22}" cy="${MOON.y - 14}" r="13" fill="#e8d3ad" opacity="0.7"/>` +
    `<circle cx="${MOON.x + 24}" cy="${MOON.y + 18}" r="9" fill="#e8d3ad" opacity="0.6"/>` +
    `<circle cx="${MOON.x + 12}" cy="${MOON.y - 30}" r="6" fill="#e8d3ad" opacity="0.5"/>`
  )
}

function clouds(waiting: boolean): string {
  const tone = waiting ? '#ff8f6a' : '#f3a57a'
  const band = (x: number, y: number, w: number, o: number) =>
    `<ellipse cx="${x}" cy="${y}" rx="${w}" ry="${n(w * 0.06)}" fill="${tone}" opacity="${o}"/>`
  return (
    `<g class="drift">${band(170, 300, 260, 0.16)}${band(320, 330, 180, 0.12)}${band(1420, 470, 240, 0.14)}</g>` +
    `<g class="drift2">${band(1300, 210, 220, 0.1)}${band(120, 470, 200, 0.12)}${band(1500, 540, 160, 0.1)}</g>`
  )
}

function mountains(waiting: boolean): string {
  const far = waiting ? '#4a1626' : '#3a1d3e'
  const near = waiting ? '#2a0c18' : '#22122a'
  return (
    `<path fill="${far}" d="M0,760L90,700L170,730L300,610L420,690L520,650L640,720L760,680L880,720L1000,640L1120,700L1240,620L1380,690L1480,640L1600,700L1600,1000L0,1000Z"/>` +
    '<rect y="640" width="1600" height="220" fill="url(#haze)"/>' +
    `<path fill="${near}" d="M0,840Q120,780 240,820T480,810T720,830T960,800T1200,830T1440,790T1600,820L1600,1000L0,1000Z"/>`
  )
}

// A curved eave: wider than the wall, tips turned up.
function roof(x: number, y: number, w: number, rise = 18): string {
  return `<path d="M${n(x - 14)},${n(y + 2)}Q${n(x + 4)},${n(y - 4)} ${n(x + 10)},${n(y - rise)}L${n(x + w - 10)},${n(y - rise)}Q${n(x + w - 4)},${n(y - 4)} ${n(x + w + 14)},${n(y + 2)}Z"/>`
}

function windows(r: Random, x: number, top: number, w: number, h: number): string {
  let out = ''
  const cols = Math.max(1, Math.floor((w - 10) / 22))
  const rows = Math.max(1, Math.floor((h - 14) / 24))
  for (let c = 0; c < cols; c++) {
    for (let row = 0; row < rows; row++) {
      if (r.next() > 0.38) continue
      const wx = n(x + 10 + c * 22 + r.pick(0, 4))
      const wy = n(top + 12 + row * 24)
      const flicker = r.next() < 0.3
      out += flicker
        ? `<rect class="win" x="${wx}" y="${wy}" width="7" height="10" style="animation-duration:${n(r.pick(5, 13))}s;animation-delay:-${n(r.pick(0, 10))}s"/>`
        : `<rect x="${wx}" y="${wy}" width="7" height="10"/>`
    }
  }
  return out
}

function village(): string {
  const r = seeded(7)
  let walls = ''
  let lights = ''
  for (let x = -20; x < 1640; ) {
    const w = r.pick(70, 140)
    const centre = x + w > CHAT.left && x < CHAT.right
    const h = centre ? r.pick(50, 80) : r.pick(64, 125)
    const top = 1000 - h
    walls += `<rect x="${n(x)}" y="${n(top)}" width="${n(w)}" height="${n(h)}"/>` + roof(x, top, w)
    if (r.next() < 0.3) {
      // A second, smaller tier.
      const tw = w * 0.56
      const tx = x + (w - tw) / 2
      walls += `<rect x="${n(tx)}" y="${n(top - 36)}" width="${n(tw)}" height="20"/>` + roof(tx, top - 36, tw, 14)
    }
    lights += windows(r, x, top, w, h)
    x += w + r.pick(6, 20)
  }
  return `<g fill="${INK}">${walls}</g><g fill="#ffb347" opacity="0.85">${lights}</g>`
}

// A five-tier pagoda at the left.
function pagoda(): string {
  const cx = 150
  let y = 1000
  let out = ''
  let lights = ''
  const widths = [150, 128, 106, 86, 66]
  widths.forEach((w, i) => {
    const h = i === 0 ? 70 : 40
    const body = w * 0.7
    out += `<rect x="${n(cx - body / 2)}" y="${n(y - h)}" width="${n(body)}" height="${h}"/>` + roof(cx - w / 2, y - h, w, 20)
    lights += `<rect x="${cx - 4}" y="${n(y - h + 12)}" width="8" height="12"/>`
    y -= h + 18
  })
  out += `<rect x="${cx - 2}" y="${y - 70}" width="4" height="72"/>`
  out += [0, 14, 28].map(d => `<ellipse cx="${cx}" cy="${y - 20 - d}" rx="7" ry="2.5"/>`).join('')
  return `<g fill="${INK}">${out}</g><g fill="#ffb347" opacity="0.8">${lights}</g>`
}

// A watchtower at the right, where the shinobi waits.
function watchtower(): string {
  const { x, top } = TOWER
  const hut = top + 22
  return (
    `<g stroke="${INK}" stroke-width="7" fill="none">` +
    `<path d="M${x - 40},1000L${x - 24},${hut + 40}M${x + 40},1000L${x + 24},${hut + 40}"/>` +
    `<path stroke-width="4" d="M${x - 36},960L${x + 32},880M${x + 36},960L${x - 32},880M${x - 30},880L${x + 30},800M${x + 30},880L${x - 30},800"/>` +
    '</g>' +
    `<g fill="${INK}"><rect x="${x - 34}" y="${hut}" width="68" height="44"/>` +
    roof(x - 38, hut, 76, 22) +
    `<rect x="${x - 44}" y="${hut + 40}" width="88" height="6"/></g>` +
    `<rect x="${x - 8}" y="${hut + 12}" width="16" height="14" fill="#ffb347" opacity="0.85"/>`
  )
}

// Red paper lanterns on a string from the pagoda.
function lanterns(): string {
  const p0 = { x: 222, y: 880 }
  const c = { x: 380, y: 935 }
  const p2 = { x: 540, y: 900 }
  const at = (t: number) => ({
    x: (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * c.x + t * t * p2.x,
    y: (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * c.y + t * t * p2.y,
  })
  let out = `<path d="M${p0.x},${p0.y}Q${c.x},${c.y} ${p2.x},${p2.y}" stroke="#2a1410" stroke-width="2" fill="none"/>`
  ;[0.16, 0.36, 0.56, 0.76].forEach((t, i) => {
    const p = at(t)
    out +=
      `<g transform="translate(${n(p.x)} ${n(p.y)})">` +
      `<circle cy="20" r="26" fill="url(#lampglow)"/>` +
      `<g class="sway" style="animation-delay:-${n(i * 1.3)}s">` +
      '<line y2="8" stroke="#2a1410" stroke-width="2"/>' +
      '<rect x="-4" y="7" width="8" height="3" fill="#2a1410"/>' +
      '<ellipse cy="20" rx="9" ry="11" fill="#d8392b"/>' +
      '<ellipse cy="20" rx="4" ry="9" fill="#ff7a45" opacity="0.7"/>' +
      '<rect x="-4" y="30" width="8" height="3" fill="#2a1410"/>' +
      '</g></g>'
  })
  return out
}

// ---------- moving parts ----------

const FALL_DX = -520
const FALL_FROM = -80
const FALL_TO = 1100

function fallingLeaves(r: Random, count: number, pace: number): string {
  let out = ''
  for (let i = 0; i < count; i++) {
    const x0 = r.pick(60, 2050)
    const dur = r.pick(11, 19) * pace
    const lead = r.next()
    const restX = n(FALL_DX * lead)
    const restY = n(FALL_FROM + (FALL_TO - FALL_FROM) * lead)
    const color = LEAF_COLORS[Math.floor(r.next() * LEAF_COLORS.length)]!
    const spin = r.next() < 0.5 ? 'spin' : 'spinr'
    const size = n(r.pick(0.8, 1.7))
    out +=
      `<g transform="translate(${n(x0)} 0)">` +
      `<g class="fall" style="animation-duration:${n(dur)}s;animation-delay:-${n(lead * dur)}s;transform:translate(${restX}px,${restY}px)">` +
      `<g class="bob" style="animation-duration:${n(r.pick(2.2, 4))}s;animation-delay:-${n(r.pick(0, 3))}s">` +
      `<g class="${spin}" style="animation-duration:${n(r.pick(3, 7))}s">` +
      `<use href="#leaf" fill="${color}" transform="scale(${size})"/>` +
      '</g></g></g></g>'
  }
  return `<g opacity="0.9">${out}</g>`
}

// The runner crosses during the first part of each cycle, then waits offscreen.
const RUN_S = 26
const RUN_SHARE = 0.42
const RUN_FROM = -120
const RUN_TO = 1720
const RUN_Y = 852

function runKeyframes(): string {
  const hops = 12
  const ys = [0, -38, -52, -38]
  const stops: string[] = []
  for (let i = 0; i < hops; i++) {
    ys.forEach((y, j) => {
      const t = (i + j / ys.length) / hops
      stops.push(`${n(t * RUN_SHARE * 100)}%{transform:translate(${n(RUN_FROM + t * (RUN_TO - RUN_FROM))}px,${y}px)}`)
    })
  }
  stops.push(`${n(RUN_SHARE * 100)}%{transform:translate(${RUN_TO}px,0px)}`)
  stops.push(`100%{transform:translate(${RUN_TO}px,0px)}`)
  return `@keyframes run{${stops.join('')}}`
}

function runner(): string {
  return (
    `<g transform="translate(0 ${RUN_Y})">` +
    `<g class="run" style="transform:translate(${RUN_FROM}px,0px)">` +
    `<g fill="${INK}"><circle cx="6" cy="-35" r="5.5"/><path d="${RUNNER}"/></g>` +
    '<path d="M2,-37C-6,-39 -12,-35 -20,-39M2,-36C-6,-35 -13,-31 -19,-33" stroke="#c23a2a" stroke-width="2" fill="none"/>' +
    '</g></g>'
  )
}

function stander(): string {
  const { x, top } = TOWER
  return (
    `<g transform="translate(${x} ${top})">` +
    `<g fill="${INK}"><circle cy="-37" r="5.5"/><path d="${STANDER}"/></g>` +
    '<g transform="translate(-3 -31)"><g class="flutter">' +
    '<path d="M0,0C-12,1 -20,7 -32,4L-31,8C-20,11 -11,5 0,3Z" fill="#c23a2a"/>' +
    '</g></g>' +
    '<g transform="translate(-3 -39)"><g class="flutter" style="animation-delay:-0.4s">' +
    '<path d="M0,0C-8,-1 -14,2 -22,-1" stroke="#c23a2a" stroke-width="2" fill="none"/>' +
    '</g></g></g>'
  )
}

function ringOfLeaves(r: Random, count: number, radius: [number, number]): string {
  let out = ''
  const phase = r.pick(0, 360)
  for (let i = 0; i < count; i++) {
    const a = phase + (360 / count) * i + r.pick(-8, 8)
    const rad = (a * Math.PI) / 180
    const d = r.pick(radius[0], radius[1])
    const color = LEAF_COLORS[Math.floor(r.next() * LEAF_COLORS.length)]!
    out += `<use href="#leaf" fill="${color}" transform="translate(${n(Math.cos(rad) * d)} ${n(Math.sin(rad) * d)}) rotate(${n(a)}) scale(${n(r.pick(1, 1.8))})"/>`
  }
  return out
}

function seal(r: Random): { css: string; svg: string } {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 * Math.PI) / 180
    return `M${n(Math.cos(a) * 84)},${n(Math.sin(a) * 84)}L${n(Math.cos(a) * 100)},${n(Math.sin(a) * 100)}`
  }).join('')
  // The shuriken flies in from the left and lands in the ring.
  const dx = n(-r.pick(700, 1000))
  const dy = n(r.pick(-260, 320))
  return {
    css:
      `@keyframes throw{from{transform:translate(${dx}px,${dy}px)}to{transform:translate(0px,0px)}}`,
    svg:
      `<g transform="translate(${SEAL.x} ${SEAL.y})">` +
      '<circle r="210" fill="url(#sealglow)" class="pulse"/>' +
      '<g class="appear">' +
      `<g class="ring"><circle r="92" fill="none" stroke="#ff9a3c" stroke-width="3" stroke-dasharray="16 9"/><path d="${ticks}" stroke="#ffb35c" stroke-width="2.5"/></g>` +
      '<circle r="72" fill="#1a0810" fill-opacity="0.6" stroke="#ffb35c" stroke-width="2.5"/>' +
      `<text y="2" font-size="76" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="#ffd9a0" font-family="'Yu Mincho','MS Mincho','Hiragino Mincho ProN','Noto Serif CJK JP',serif">忍</text>` +
      '</g>' +
      `<g class="whirl" opacity="0.95">${ringOfLeaves(r, 18, [125, 170])}</g>` +
      `<g class="whirl2" opacity="0.75">${ringOfLeaves(r, 12, [200, 228])}</g>` +
      '<g transform="translate(-70 -62)"><g class="throw"><g class="twirl">' +
      `<path d="${SHURIKEN}" fill="#3a3640" stroke="#b9b4c4" stroke-width="1.5"/><circle r="4" fill="${INK}"/>` +
      '</g></g></g>' +
      '</g>',
  }
}

// ---------- composing ----------

const BASE_CSS = `
.drift { animation: drift 46s ease-in-out infinite alternate; }
.drift2 { animation: drift2 58s ease-in-out infinite alternate; }
@keyframes drift { from { transform: translateX(-40px); } to { transform: translateX(50px); } }
@keyframes drift2 { from { transform: translateX(40px); } to { transform: translateX(-60px); } }
.fall { animation: fall 15s linear infinite; will-change: transform; }
@keyframes fall { from { transform: translate(0px, ${FALL_FROM}px); } to { transform: translate(${FALL_DX}px, ${FALL_TO}px); } }
.bob { animation: bob 3s ease-in-out infinite alternate; }
@keyframes bob { from { transform: translateX(-14px); } to { transform: translateX(14px); } }
.spin, .spinr { transform-box: fill-box; transform-origin: center; }
.spin { animation: spin 5s linear infinite; }
.spinr { animation: spinr 5s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes spinr { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
.sway { animation: sway 3.4s ease-in-out infinite alternate; transform-origin: 0 0; }
@keyframes sway { from { transform: rotate(-7deg); } to { transform: rotate(7deg); } }
.win { animation: flick 9s steps(1) infinite; }
@keyframes flick { 0% { opacity: 1; } 64% { opacity: 0.25; } 72% { opacity: 1; } }
`

const RUN_CSS = `.run { animation: run ${RUN_S}s linear 3s infinite; }
${runKeyframes()}`

const WAIT_CSS = `
.pulse { animation: pulse 3.6s ease-in-out infinite alternate; }
@keyframes pulse { from { opacity: 0.55; } to { opacity: 1; } }
.appear { animation: appear 1.6s ease-out 1; }
@keyframes appear { from { opacity: 0; } to { opacity: 1; } }
.ring { animation: ring 36s linear infinite; transform-origin: 0 0; }
@keyframes ring { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.whirl { animation: whirl 9s linear infinite; transform-origin: 0 0; }
.whirl2 { animation: whirl2 15s linear infinite; transform-origin: 0 0; }
@keyframes whirl { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes whirl2 { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
.throw { animation: throw 0.8s ease-out 1; }
.twirl { animation: twirl 0.2s linear 4; transform-box: fill-box; transform-origin: center; }
@keyframes twirl { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.flutter { animation: flutter 1.4s ease-in-out infinite alternate; transform-origin: 0 0; }
@keyframes flutter { from { transform: rotate(-8deg); } to { transform: rotate(6deg); } }
`

const STILLED =
  '.drift, .drift2, .fall, .bob, .spin, .spinr, .sway, .win, .run, .pulse, .appear, .ring, .whirl, .whirl2, .throw, .twirl, .flutter'

// The village, moon and lanterns never change, so build them once.
const MOON_SVG = moon()
const VILLAGE_SVG = village() + pagoda() + watchtower() + lanterns()

function build(waiting: boolean, burst: number): string {
  const r = seeded(waiting ? burst : 1999)
  const leaves = fallingLeaves(r, waiting ? 10 : 24, waiting ? 1.6 : 1)
  const s = waiting ? seal(r) : undefined
  const css = BASE_CSS + (s ? WAIT_CSS + s.css : RUN_CSS)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<defs>${sky(waiting)}${DEFS}</defs>
<style>
${css}
@media (prefers-reduced-motion: reduce) {
  ${STILLED} { animation: none; }
}
</style>
<rect width="1600" height="1000" fill="url(#sky)"/>
${MOON_SVG}
${clouds(waiting)}
${mountains(waiting)}
${s ? s.svg : ''}
${leaves}
${VILLAGE_SVG}
${waiting ? stander() : runner()}
</svg>`
}

// The working scene never changes. A waiting scene is built once per burst and kept.
const WORKING = build(false, 0)
let waitingScene: { burst: number; svg: string } | undefined

export function sceneFor(signal: Signal): string {
  if (signal.mode !== 'waiting') return WORKING
  if (waitingScene?.burst !== signal.burst) {
    waitingScene = { burst: signal.burst, svg: build(true, signal.burst) }
  }
  return waitingScene.svg
}

export function altFor(signal: Signal): string {
  return signal.mode === 'waiting'
    ? 'A ninja village under a red dusk sky, a glowing seal ringed by whirling leaves, a shinobi waiting on the watchtower: Claude needs you'
    : 'A ninja village at dusk with falling leaves, swaying lanterns and a shinobi leaping across the rooftops: Claude is working'
}
