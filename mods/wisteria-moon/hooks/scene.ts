import type { Signal } from '../types'

// Wisteria Moon: a Taisho-era night by a river, all original vector art.
//
// While Claude works: wisteria hangs from wooden pergolas in both top corners and sheds
// petals, a castle keeps its lamps lit on the far ridge, mist drifts between the
// mountains, a red arched bridge and stone lanterns glow by the river, fireflies hover,
// reeds sway, and a lone swordsman keeps watch on a rock under a great moon.
// When Claude needs you: the sky and river turn crimson, the swordsman raises his
// blade, and two crescent arcs, one of water and one of flame, sweep around the moon
// while embers rise from the river.
//
// CSS animation only, no script. Each moving part rests where it ends, so reduced
// motion still shows a finished picture. No full-size layer's opacity is animated.

type Random = { next: () => number; pick: (min: number, max: number) => number }

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

const MOON = { x: 1300, y: 300, r: 118 }
const RIVER = 790

type Palette = {
  sky: string[]
  nebula: string
  moon: [string, string]
  halo: string
  ridge: [string, string][]
  fog: string
  water: [string, string]
  glint: string
  ink: string
  rim: string
}

const NIGHT: Palette = {
  sky: ['#03050f', '#0a1030', '#18205a', '#2c2a6e', '#3d3270'],
  nebula: '#6a5cff',
  moon: ['#fffaf0', '#e9e1cf'],
  halo: '#c9d4ff',
  ridge: [['#2b2f6e', '#1c1f52'], ['#1e2257', '#141741'], ['#131637', '#0c0e28'], ['#0a0b20', '#06071a']],
  fog: '#b7c2ff',
  water: ['#151d52', '#05071a'],
  glint: '#e9eeff',
  ink: '#05060f',
  rim: '#cfd8ff',
}

const CRIMSON: Palette = {
  sky: ['#080206', '#22040c', '#4a0a16', '#7a1620', '#9a2a22'],
  nebula: '#ff3a4a',
  moon: ['#ffe2d2', '#f4b8a0'],
  halo: '#ff6a4a',
  ridge: [['#5a1424', '#3e0c1a'], ['#3e0c18', '#2a0812'], ['#26060f', '#18040a'], ['#120308', '#0a0205']],
  fog: '#ff9a8a',
  water: ['#3a0a16', '#0a0206'],
  glint: '#ffc4b0',
  ink: '#060205',
  rim: '#ffb39a',
}

// ---------- defs shared by both states ----------

function defs(p: Palette): string {
  const g = (id: string, stops: [number, string, number?][], x2 = 0, y2 = 1) =>
    `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">` +
    stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`).join('') +
    '</linearGradient>'
  const rg = (id: string, stops: [number, string, number?][], extra = '') =>
    `<radialGradient id="${id}"${extra}>` +
    stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`).join('') +
    '</radialGradient>'
  return (
    g('sky', p.sky.map((c, i) => [[0, 0.28, 0.52, 0.7, 0.8][i]!, c])) +
    rg('neb', [[0, p.nebula, 0.22], [1, p.nebula, 0]]) +
    rg('moonface', [[0, p.moon[0]], [0.75, p.moon[1]], [1, p.moon[1]]], ' cx="0.42" cy="0.38" r="0.7"') +
    rg('halo1', [[0.45, p.halo, 0.42], [1, p.halo, 0]]) +
    rg('halo2', [[0.2, p.halo, 0.16], [1, p.halo, 0]]) +
    rg('crater', [[0, '#000', 0.12], [0.7, '#000', 0.05], [1, '#000', 0]]) +
    p.ridge.map(([a, b], i) => g(`r${i}`, [[0, a], [1, b]])).join('') +
    g('mist', [[0, p.fog, 0], [0.5, p.fog, 0.22], [1, p.fog, 0]]) +
    g('wisp', [[0, p.fog, 0], [0.3, p.fog, 0.35], [0.7, p.fog, 0.3], [1, p.fog, 0]], 1, 0) +
    g('water', [[0, p.water[0]], [1, p.water[1]]]) +
    g('column', [[0, p.glint, 0.55], [1, p.glint, 0]]) +
    rg('lamp', [[0, '#ffcf7a', 0.85], [0.4, '#ff9a3a', 0.35], [1, '#ff9a3a', 0]]) +
    rg('fly', [[0, '#e8ff9a', 0.9], [1, '#e8ff9a', 0]]) +
    rg('vign', [[0.55, '#000', 0], [1, '#000', 0.55]], ' cx="0.5" cy="0.45" r="0.75"') +
    // Wisteria blossoms: light at the tips, deep at the top.
    rg('w1', [[0, '#f1e6ff'], [1, '#b89af0']]) +
    rg('w2', [[0, '#d7c2fb'], [1, '#9070d8']]) +
    rg('w3', [[0, '#b294ea'], [1, '#6a4cb8']]) +
    g('wood', [[0, '#3a2618'], [1, '#1c120a']]) +
    g('lacquer', [[0, '#b0322a'], [1, '#5a1410']]) +
    // A floret: three petals around a point.
    '<g id="fl"><circle cx="-3.2" cy="0" r="3.4"/><circle cx="3.2" cy="0" r="3.4"/><circle cx="0" cy="3" r="3.6"/></g>' +
    '<path id="leaf" d="M0,0C5,-4 14,-4 20,0C14,4 5,4 0,0Z"/>' +
    '<path id="petal" d="M0,-4C3,-3 4,1 0,4C-4,1 -3,-3 0,-4Z"/>'
  )
}

// ---------- sky ----------

function sky(p: Palette, r: Random): string {
  let stars = ''
  for (let i = 0; i < 95; i++) {
    const x = r.pick(0, 1600)
    const y = r.pick(0, 560)
    const big = r.next() < 0.08
    const tw = r.next() < 0.35
    stars += big
      ? `<path d="M${n(x)},${n(y - 5)}L${n(x + 1)},${n(y - 1)}L${n(x + 5)},${n(y)}L${n(x + 1)},${n(y + 1)}L${n(x)},${n(y + 5)}L${n(x - 1)},${n(y + 1)}L${n(x - 5)},${n(y)}L${n(x - 1)},${n(y - 1)}Z" class="tw" style="animation-delay:-${n(r.pick(0, 6))}s"/>`
      : `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r.pick(0.5, 1.5))}"${tw ? ` class="tw" style="animation-delay:-${n(r.pick(0, 6))}s"` : ''}/>`
  }
  return (
    '<rect width="1600" height="1000" fill="url(#sky)"/>' +
    '<ellipse cx="520" cy="240" rx="520" ry="180" fill="url(#neb)"/>' +
    '<ellipse cx="980" cy="120" rx="420" ry="120" fill="url(#neb)" opacity="0.7"/>' +
    `<g fill="${p.glint}" opacity="0.85">${stars}</g>`
  )
}

function moon(): string {
  const { x, y, r } = MOON
  const crater = (dx: number, dy: number, s: number) => `<circle cx="${x + dx}" cy="${y + dy}" r="${s}" fill="url(#crater)"/>`
  return (
    `<circle cx="${x}" cy="${y}" r="${r * 3.4}" fill="url(#halo2)"/>` +
    `<circle cx="${x}" cy="${y}" r="${r * 1.7}" fill="url(#halo1)" class="breathe"/>` +
    `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#moonface)"/>` +
    crater(-40, -30, 26) + crater(30, 36, 20) + crater(14, -56, 12) + crater(-20, 50, 14) + crater(56, -10, 10) + crater(-62, 14, 9) +
    // Thin clouds drifting across the moon.
    `<g class="wisps"><rect x="${x - 260}" y="${y + 20}" width="380" height="9" rx="4.5" fill="url(#wisp)"/>` +
    `<rect x="${x - 120}" y="${y + 44}" width="300" height="6" rx="3" fill="url(#wisp)"/>` +
    `<rect x="${x - 40}" y="${y - 70}" width="260" height="5" rx="2.5" fill="url(#wisp)" opacity="0.7"/></g>`
  )
}

// ---------- land ----------

function castle(p: Palette): string {
  // A small hill castle on the far ridge: stone base, three tiers, lit windows.
  const tier = (w: number, y: number, h: number) =>
    `<rect x="${-w / 2}" y="${y - h}" width="${w}" height="${h}"/>` +
    `<path d="M${-w / 2 - 12},${y - h + 2}Q${-w / 2 - 2},${y - h - 2} ${-w / 2 + 4},${y - h - 14}L${w / 2 - 4},${y - h - 14}Q${w / 2 + 2},${y - h - 2} ${w / 2 + 12},${y - h + 2}Z"/>`
  return (
    `<g transform="translate(330 528)"><g fill="${p.ridge[0]![1]}">` +
    '<path d="M-60,40L-46,0L46,0L60,40Z"/>' +
    tier(70, 0, 20) + tier(54, -34, 18) + tier(38, -66, 16) +
    '<path d="M-6,-96L0,-108L6,-96Z"/>' +
    '</g><g fill="#ffc46a">' +
    '<rect x="-24" y="-14" width="4" height="6" class="lit" style="animation-delay:-1s"/><rect x="-8" y="-14" width="4" height="6"/><rect x="10" y="-14" width="4" height="6" class="lit" style="animation-delay:-3s"/>' +
    '<rect x="-14" y="-46" width="4" height="6"/><rect x="8" y="-46" width="4" height="6" class="lit" style="animation-delay:-2s"/><rect x="-2" y="-76" width="4" height="6"/>' +
    '</g></g>'
  )
}

function ridges(p: Palette): string {
  return (
    '<path fill="url(#r0)" d="M0,600L70,560L150,585L240,520L330,560L420,530L520,575L640,540L760,585L880,545L990,580L1100,520L1210,570L1330,530L1440,575L1530,540L1600,560L1600,1000L0,1000Z"/>' +
    castle(p) +
    '<rect y="560" width="1600" height="90" fill="url(#mist)" class="mist"/>' +
    '<path fill="url(#r1)" d="M0,670Q90,610 200,640T420,620T650,655T880,625T1120,650T1360,612T1600,640L1600,1000L0,1000Z"/>' +
    '<rect y="640" width="1600" height="80" fill="url(#mist)" class="mist2" opacity="0.8"/>' +
    '<path fill="url(#r2)" d="M0,735Q140,690 300,712T620,705T940,722T1260,698T1600,715L1600,1000L0,1000Z"/>' +
    // Pines along the near bank, left and right.
    pines(p, [30, 70, 110, 160, 1180, 1225, 1560], 730) +
    '<path fill="url(#r3)" d="M0,800Q200,770 420,788T860,792T1300,780T1600,790L1600,1000L0,1000Z"/>'
  )
}

function pines(p: Palette, xs: number[], base: number): string {
  return `<g fill="${p.ridge[2]![1]}">${xs
    .map((x, i) => {
      const h = 46 + (i % 3) * 14
      return `<path d="M${x},${base - h}L${x - 9},${base - h * 0.62}L${x - 5},${base - h * 0.62}L${x - 15},${base - h * 0.3}L${x - 8},${base - h * 0.3}L${x - 20},${base}L${x + 20},${base}L${x + 8},${base - h * 0.3}L${x + 15},${base - h * 0.3}L${x + 5},${base - h * 0.62}L${x + 9},${base - h * 0.62}Z"/>`
    })
    .join('')}</g>`
}

// ---------- river ----------

function river(p: Palette): string {
  const crest = (y: number, amp: number) => {
    let d = `M-400,${y}`
    for (let x = -400; x < 2000; x += 200) d += `Q${x + 50},${y - amp} ${x + 100},${y}T${x + 200},${y}`
    return d
  }
  const { x } = MOON
  let column = ''
  for (let i = 0; i < 9; i++) {
    const w = 150 - i * 12
    column += `<rect class="glint" x="${x - w / 2 + (i % 2 ? 6 : -6)}" y="${RIVER + 10 + i * 22}" width="${w}" height="${i < 3 ? 4 : 3}" rx="2" style="animation-delay:-${n(i * 0.45)}s"/>`
  }
  return (
    `<rect y="${RIVER}" width="1600" height="${1000 - RIVER}" fill="url(#water)"/>` +
    `<rect x="${x - 80}" y="${RIVER}" width="160" height="${1000 - RIVER}" fill="url(#column)" opacity="0.35"/>` +
    `<g fill="${p.glint}" opacity="0.75">${column}</g>` +
    `<g fill="none" stroke="${p.glint}" stroke-linecap="round">` +
    `<g class="flow" opacity="0.28"><path d="${crest(RIVER + 30, 6)}" stroke-width="1.5"/></g>` +
    `<g class="flow2" opacity="0.22"><path d="${crest(RIVER + 70, 8)}" stroke-width="2"/></g>` +
    `<g class="flow" opacity="0.16"><path d="${crest(RIVER + 125, 10)}" stroke-width="2.5"/></g>` +
    '</g>'
  )
}

// Woodblock-style curling waves in the lower-left corner.
function curls(p: Palette): string {
  const curl = (x: number, y: number, s: number, d: number) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><g class="curl" style="animation-delay:-${d}s">` +
    `<path d="M-90,60C-60,-10 10,-70 90,-60C150,-52 170,0 130,24C100,42 70,20 82,-4C92,-22 118,-14 112,4" fill="${p.water[0]}" stroke="${p.glint}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>` +
    `<path d="M-60,40C-30,-14 30,-50 80,-44" fill="none" stroke="${p.glint}" stroke-width="2.5" opacity="0.55"/>` +
    `<path d="M-40,58C-10,20 40,0 70,4" fill="none" stroke="${p.glint}" stroke-width="2" opacity="0.4"/>` +
    // Foam fingers on the crest.
    `<path d="M88,-60l8,-12l2,12l10,-8l-2,12l12,-2l-8,10" fill="none" stroke="${p.glint}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>` +
    '</g></g>'
  return curl(70, 950, 1.05, 0) + curl(230, 985, 0.7, 2)
}

// ---------- bridge, lanterns, reeds ----------

function bridge(p: Palette): string {
  // A red arched bridge across the left of the river, with its reflection.
  const deck = 'M40,800Q250,700 470,800'
  const under = 'M60,812Q250,724 450,812'
  const posts = [70, 120, 170, 220, 270, 320, 370, 420]
    .map(x => {
      const t = (x - 40) / 430
      const y = 800 - Math.sin(t * Math.PI) * 50
      return `<rect x="${x - 3}" y="${n(y - 30)}" width="6" height="30" rx="1"/><circle cx="${x}" cy="${n(y - 32)}" r="4.5"/>`
    })
    .join('')
  const rail = (dy: number) => {
    const pts: string[] = []
    for (let x = 70; x <= 420; x += 10) {
      const t = (x - 40) / 430
      pts.push(`${x},${n(800 - Math.sin(t * Math.PI) * 50 - dy)}`)
    }
    return `<polyline points="${pts.join(' ')}" fill="none" stroke="url(#lacquer)" stroke-width="4"/>`
  }
  const span = `<path d="${deck}L470,812Q250,722 40,812Z" fill="url(#lacquer)"/><path d="${under}" fill="none" stroke="#2a0808" stroke-width="3"/>`
  return (
    `<g opacity="0.25" transform="translate(0 1608) scale(1 -1)">${span}</g>` +
    span +
    `<g fill="url(#lacquer)">${posts}</g>` +
    rail(26) +
    rail(14) +
    // Stone feet.
    `<path d="M30,800L60,800L66,830L24,830Z" fill="${p.ridge[2]![0]}"/><path d="M450,800L480,800L486,830L444,830Z" fill="${p.ridge[2]![0]}"/>`
  )
}

function lantern(x: number, base: number, s: number, d: number): string {
  return (
    `<g transform="translate(${x} ${base}) scale(${s})">` +
    `<circle cy="-62" r="46" fill="url(#lamp)" class="flicker" style="animation-delay:-${d}s"/>` +
    '<g fill="#14151f">' +
    '<rect x="-16" y="-8" width="32" height="8" rx="2"/>' +
    '<rect x="-6" y="-40" width="12" height="32"/>' +
    '<rect x="-14" y="-48" width="28" height="8"/>' +
    '<rect x="-12" y="-74" width="24" height="26"/>' +
    '<path d="M-24,-74L0,-92L24,-74Z"/>' +
    '<rect x="-3" y="-100" width="6" height="9" rx="3"/>' +
    '</g>' +
    '<rect x="-7" y="-70" width="14" height="16" fill="#ffc46a"/>' +
    '<rect x="-1" y="-70" width="2" height="16" fill="#14151f"/>' +
    '</g>'
  )
}

function reeds(r: Random, x0: number, x1: number, base: number, color: string): string {
  let out = ''
  for (let x = x0; x < x1; x += r.pick(7, 13)) {
    const h = r.pick(40, 95)
    const lean = r.pick(-12, 12)
    out +=
      `<g transform="translate(${n(x)} ${base})"><g class="reed" style="animation-duration:${n(r.pick(3, 5.5))}s;animation-delay:-${n(r.pick(0, 5))}s">` +
      `<path d="M0,0Q${n(lean * 0.4)},${n(-h * 0.5)} ${n(lean)},${n(-h)}" stroke="${color}" stroke-width="${n(r.pick(1.6, 3))}" fill="none" stroke-linecap="round"/>` +
      (r.next() < 0.35 ? `<ellipse cx="${n(lean)}" cy="${n(-h - 6)}" rx="2.6" ry="8" fill="${color}"/>` : '') +
      '</g></g>'
  }
  return out
}

// ---------- wisteria ----------

function pergola(side: 'left' | 'right'): string {
  // A wooden beam and two struts reaching in from the corner.
  return side === 'left'
    ? '<path d="M-20,22L470,34L472,48L-20,40Z" fill="url(#wood)"/><path d="M-20,54L360,60L360,70L-20,66Z" fill="url(#wood)" opacity="0.8"/><path d="M440,30L470,30L470,120L456,120Z" fill="url(#wood)"/>'
    : '<path d="M1130,36L1620,20L1620,38L1132,50Z" fill="url(#wood)"/><path d="M1240,62L1620,54L1620,64L1240,72Z" fill="url(#wood)" opacity="0.8"/><path d="M1130,34L1160,34L1146,120L1132,120Z" fill="url(#wood)"/>'
}

function raceme(r: Random, x: number, y: number, len: number): string {
  // Florets grouped by shade, so each one is a bare <use>.
  const bands = ['', '', '']
  for (let i = 0; i < len; i++) {
    const t = i / len
    const s = n(1.25 - t * 0.75)
    const b = t < 0.35 ? 0 : t < 0.7 ? 1 : 2
    const dx = n(r.pick(-3, 3))
    bands[b] += `<use href="#fl" transform="translate(${dx} ${n(i * 10.5)}) scale(${s})"/>`
    if (i < len * 0.5 && r.next() < 0.3) bands[b] += `<use href="#fl" transform="translate(${n(dx + (r.next() < 0.5 ? -7 : 7) * s)} ${n(i * 10.5 + 3)}) scale(${n(s * 0.7)})"/>`
  }
  return (
    `<g transform="translate(${n(x)} ${n(y)})"><g class="sway" style="animation-duration:${n(r.pick(4.5, 7.5))}s;animation-delay:-${n(r.pick(0, 7))}s">` +
    `<path d="M0,-6V8" stroke="#3a2a1c" stroke-width="1.6"/><g fill="url(#w3)">${bands[0]}</g><g fill="url(#w2)">${bands[1]}</g><g fill="url(#w1)">${bands[2]}</g></g></g>`
  )
}

function leaves(r: Random, x0: number, x1: number, y: number): string {
  let out = ''
  for (let x = x0; x < x1; x += r.pick(14, 24)) {
    const a = n(r.pick(40, 140))
    out += `<use href="#leaf" transform="translate(${n(x)} ${n(y + r.pick(-4, 6))}) rotate(${a}) scale(${n(r.pick(0.8, 1.4))})" fill="${r.next() < 0.5 ? '#2f4a2c' : '#3e5e38'}"/>`
  }
  return out
}

function wisteria(r: Random): string {
  let out = pergola('left') + pergola('right')
  out += leaves(r, -10, 470, 44) + leaves(r, 1140, 1610, 46)
  for (let x = 0; x < 460; x += r.pick(17, 26)) out += raceme(r, x, 46 + (x / 470) * 8, Math.round(r.pick(9, 18)))
  for (let x = 1150; x < 1610; x += r.pick(17, 26)) out += raceme(r, x, 48 - ((x - 1130) / 490) * 14, Math.round(r.pick(6, 12)))
  out += leaves(r, 0, 460, 58) + leaves(r, 1150, 1600, 58)
  return out
}

function petals(r: Random, count: number, pace: number): string {
  let out = ''
  for (let i = 0; i < count; i++) {
    const left = r.next() < 0.5
    const x0 = left ? r.pick(0, 560) : r.pick(1060, 1760)
    const dur = r.pick(12, 20) * pace
    const lead = r.next()
    const fill = ['url(#w1)', 'url(#w2)', '#c7b0f2'][Math.floor(r.next() * 3)]!
    out +=
      `<g transform="translate(${n(x0)} 0)"><g class="fall" style="animation-duration:${n(dur)}s;animation-delay:-${n(lead * dur)}s;transform:translate(${n(-280 * lead)}px,${n(-30 + 1060 * lead)}px)">` +
      `<g class="bob" style="animation-duration:${n(r.pick(2, 3.6))}s"><g class="spin" style="animation-duration:${n(r.pick(2.5, 5))}s"><use href="#petal" fill="${fill}" transform="scale(${n(r.pick(0.9, 1.6))})"/></g></g></g></g>`
  }
  return out
}

function fireflies(r: Random): string {
  let out = ''
  for (let i = 0; i < 22; i++) {
    const x = r.next() < 0.5 ? r.pick(30, 460) : r.pick(1150, 1580)
    const y = r.pick(640, 930)
    out +=
      `<g transform="translate(${n(x)} ${n(y)})"><g class="hover" style="animation-duration:${n(r.pick(5, 10))}s;animation-delay:-${n(r.pick(0, 9))}s">` +
      `<circle r="9" fill="url(#fly)" class="blink" style="animation-delay:-${n(r.pick(0, 4))}s"/><circle r="1.7" fill="#f4ffd0"/></g></g>`
  }
  return out
}

// ---------- the swordsman ----------

// Facing the moon, feet at 0,0. Haori with wide sleeves over flared hakama.
const BODY =
  'M-12,-92L12,-92L20,-84L30,-58L24,-52L18,-62L17,-54L26,-2L30,0L6,0L2,-28L-2,0L-26,0L-22,-2L-15,-54L-17,-62L-23,-52L-30,-58L-20,-84Z'
const BODY_READY =
  'M-10,-90L13,-92L22,-84L34,-62L26,-56L19,-64L18,-54L34,-4L40,0L14,0L4,-26L-8,-4L-30,2L-34,-2L-18,-30L-15,-54L-18,-66L-30,-60L-34,-66L-20,-84Z'

function swordsman(p: Palette, waiting: boolean): string {
  const rock =
    `<path d="M1300,900C1320,840 1400,822 1470,832C1530,840 1580,870 1610,900L1610,1000L1290,1000Z" fill="${p.ink}"/>` +
    `<path d="M1330,868C1360,846 1410,838 1450,842" stroke="${p.rim}" stroke-width="2" fill="none" opacity="0.35"/>`
  const head = waiting ? '<circle cx="-3" cy="-101" r="9.5"/>' : '<circle cy="-103" r="9.5"/>'
  const hair =
    `<g transform="translate(${waiting ? 4 : 6} -108)"><g class="flap${waiting ? ' fastflap' : ''}">` +
    `<path d="M0,0C10,-4 20,0 30,8C22,6 14,6 6,8Z" fill="${p.ink}"/></g></g>`
  const sleeve =
    `<g transform="translate(18 -84)"><g class="flap${waiting ? ' fastflap' : ''}" style="animation-delay:-0.5s">` +
    `<path d="M0,0C16,6 30,24 36,44L22,46C16,30 8,16 0,10Z" fill="${p.ink}"/></g></g>`
  const blade = waiting
    ? `<line x1="-8" y1="-80" x2="-100" y2="-200" stroke="${p.rim}" stroke-width="7" stroke-linecap="round" opacity="0.25"/>` +
      `<line x1="-8" y1="-80" x2="-100" y2="-200" stroke="#f4f7ff" stroke-width="3" stroke-linecap="round"/>` +
      `<line x1="-2" y1="-72" x2="-12" y2="-86" stroke="#2a1c14" stroke-width="7" stroke-linecap="round"/>` +
      `<rect x="-14" y="-90" width="12" height="4" rx="2" fill="#c9a24a" transform="rotate(-52 -8 -88)"/>`
    : `<line x1="-14" y1="-50" x2="-62" y2="-24" stroke="#1a1d2e" stroke-width="5" stroke-linecap="round"/>` +
      `<line x1="-14" y1="-50" x2="2" y2="-60" stroke="#2a1c14" stroke-width="5" stroke-linecap="round"/>`
  return (
    rock +
    `<g transform="translate(1455 836) scale(1.7)">` +
    `<g fill="${p.ink}">${head}<path d="${waiting ? BODY_READY : BODY}"/></g>` +
    hair +
    sleeve +
    blade +
    // Moonlight catching the left edge of the figure.
    `<path d="${waiting ? 'M-18,-30L-15,-54L-18,-66' : 'M-15,-54L-26,-2'}" stroke="${p.rim}" stroke-width="1.2" fill="none" opacity="0.6"/>` +
    `<path d="M-9,-110A9.5,9.5 0 0 0 -11,-96" stroke="${p.rim}" stroke-width="1.2" fill="none" opacity="0.6"/>` +
    '</g>'
  )
}

// ---------- the slash ----------

function slash(r: Random): { css: string; svg: string } {
  const tilt = n(r.pick(-30, 30))
  const water = 'M-141,51A150,150 0 1 1 141,51'
  const flame = 'M-160,115A196,196 0 1 1 160,115'
  const len = 1100
  const foam = [200, 165, 130, 95, 60, 25, -10]
    .map((deg, i) => {
      const a = (deg * Math.PI) / 180
      const d = 150 + (i % 2 ? 12 : -10)
      const cx = Math.cos(a) * d
      const cy = -Math.sin(a) * d
      return `<path class="drop" d="M${n(cx)},${n(cy)}c4,-8 12,-8 14,-2c-6,-2 -10,0 -12,4z" fill="#dff0ff" style="animation-delay:-${n(i * 0.35)}s"/>`
    })
    .join('')
  const tongues = [190, 150, 110, 70, 30]
    .map((deg, i) => {
      const a = (deg * Math.PI) / 180
      const cx = Math.cos(a) * 196
      const cy = -Math.sin(a) * 196
      return `<g transform="translate(${n(cx)} ${n(cy)}) rotate(${n(90 - deg)})"><path class="tongue" d="M-6,0C-8,-14 0,-22 2,-30C6,-20 10,-12 6,0Z" fill="#ffb347" style="animation-delay:-${n(i * 0.3)}s"/></g>`
    })
    .join('')
  return {
    css:
      `.cut{stroke-dasharray:${len};animation:cut 1s ease-out 1}` +
      `@keyframes cut{from{stroke-dashoffset:${len}}to{stroke-dashoffset:0}}` +
      '.tongue{animation:tongue 0.9s ease-in-out infinite alternate}@keyframes tongue{from{opacity:0.55}to{opacity:1}}',
    svg:
      `<g transform="translate(${MOON.x} ${MOON.y}) rotate(${tilt})">` +
      `<path class="cut" d="${water}" fill="none" stroke="#5a8cff" stroke-width="26" stroke-linecap="round" opacity="0.22"/>` +
      `<path class="cut" d="${water}" fill="none" stroke="#a8d0ff" stroke-width="11" stroke-linecap="round" opacity="0.8"/>` +
      `<path class="cut" d="${water}" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/>` +
      foam +
      `<path class="cut" d="${flame}" fill="none" stroke="#ff4a1a" stroke-width="24" stroke-linecap="round" opacity="0.25"/>` +
      `<path class="cut" d="${flame}" fill="none" stroke="#ff8a2a" stroke-width="9" stroke-linecap="round" opacity="0.9"/>` +
      `<path class="cut" d="${flame}" fill="none" stroke="#fff0c8" stroke-width="3" stroke-linecap="round"/>` +
      tongues +
      '</g>',
  }
}

function embers(r: Random): string {
  let out = ''
  for (let i = 0; i < 34; i++) {
    const x = r.pick(980, 1620)
    const dur = r.pick(5, 10)
    const lead = r.next()
    out +=
      `<g transform="translate(${n(x)} 980)"><g class="rise" style="animation-duration:${n(dur)}s;animation-delay:-${n(lead * dur)}s;transform:translate(${n(-90 * lead)}px,${n(-720 * lead)}px)">` +
      `<circle r="${n(r.pick(1.4, 3.4))}" fill="${r.next() < 0.5 ? '#ff8a3a' : '#ffd27a'}"/></g></g>`
  }
  return out
}

// ---------- composing ----------

const CSS = `
.tw { animation: tw 4s ease-in-out infinite alternate; }
@keyframes tw { from { opacity: 1; } to { opacity: 0.25; } }
.breathe { animation: breathe 6s ease-in-out infinite alternate; }
@keyframes breathe { from { opacity: 0.8; } to { opacity: 1; } }
.wisps { animation: wisps 50s ease-in-out infinite alternate; }
@keyframes wisps { from { transform: translateX(-70px); } to { transform: translateX(70px); } }
.mist { animation: mist 40s ease-in-out infinite alternate; }
.mist2 { animation: mist2 55s ease-in-out infinite alternate; }
@keyframes mist { from { transform: translateX(-50px); } to { transform: translateX(50px); } }
@keyframes mist2 { from { transform: translateX(40px); } to { transform: translateX(-60px); } }
.lit { animation: lit 7s steps(1) infinite; }
@keyframes lit { 0% { opacity: 1; } 70% { opacity: 0.35; } 80% { opacity: 1; } }
.flow { animation: flow 14s linear infinite; }
.flow2 { animation: flow 20s linear infinite reverse; }
@keyframes flow { from { transform: translateX(0px); } to { transform: translateX(-200px); } }
.glint { animation: glint 3.2s ease-in-out infinite alternate; }
@keyframes glint { from { opacity: 0.35; } to { opacity: 1; } }
.curl { animation: curl 6s ease-in-out infinite alternate; transform-origin: 0 0; }
@keyframes curl { from { transform: rotate(-3deg); } to { transform: rotate(3deg); } }
.flicker { animation: flicker 2.8s ease-in-out infinite alternate; }
@keyframes flicker { from { opacity: 0.7; } to { opacity: 1; } }
.reed { animation: reed 4s ease-in-out infinite alternate; transform-origin: 0 0; }
@keyframes reed { from { transform: rotate(-4deg); } to { transform: rotate(4deg); } }
.sway { animation: sway 6s ease-in-out infinite alternate; transform-origin: 0 0; }
@keyframes sway { from { transform: rotate(-3.5deg); } to { transform: rotate(3.5deg); } }
.fall { animation: fall 16s linear infinite; }
@keyframes fall { from { transform: translate(0px, -30px); } to { transform: translate(-280px, 1030px); } }
.bob { animation: bob 3s ease-in-out infinite alternate; }
@keyframes bob { from { transform: translateX(-12px); } to { transform: translateX(12px); } }
.spin { animation: spin 4s linear infinite; transform-box: fill-box; transform-origin: center; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.hover { animation: hover 7s ease-in-out infinite alternate; }
@keyframes hover { from { transform: translate(-18px, 10px); } to { transform: translate(18px, -14px); } }
.blink { animation: blink 2.6s ease-in-out infinite alternate; }
@keyframes blink { from { opacity: 0.2; } to { opacity: 1; } }
.flap { animation: flap 1.8s ease-in-out infinite alternate; transform-origin: 0 0; }
.fastflap { animation-duration: 0.8s; }
@keyframes flap { from { transform: rotate(-6deg); } to { transform: rotate(9deg); } }
.drop { animation: drop 2.4s ease-in-out infinite alternate; }
@keyframes drop { from { opacity: 0.25; } to { opacity: 1; } }
.rise { animation: rise 7s linear infinite; }
@keyframes rise { from { transform: translate(0px, 0px); } to { transform: translate(-90px, -720px); } }
`

const STILLED =
  '.tw, .breathe, .wisps, .mist, .mist2, .lit, .flow, .flow2, .glint, .curl, .flicker, .reed, .sway, .fall, .bob, .spin, .hover, .blink, .flap, .drop, .rise, .cut, .tongue'

export function build(waiting: boolean, burst: number): string {
  const p = waiting ? CRIMSON : NIGHT
  const r = seeded(waiting ? burst : 1999)
  const cut = waiting ? slash(r) : undefined
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<defs>${defs(p)}</defs>
<style>
${CSS}${cut ? cut.css : ''}
@media (prefers-reduced-motion: reduce) { ${STILLED} { animation: none; } }
</style>
${sky(p, seeded(7))}
${moon()}
${cut ? cut.svg : ''}
${ridges(p)}
${river(p)}
${bridge(p)}
${lantern(1215, 832, 1, 0)}
${lantern(560, 800, 0.6, 1.4)}
${curls(p)}
${fireflies(seeded(5))}
${waiting ? embers(r) : ''}
${swordsman(p, waiting)}
${reeds(seeded(21), 480, 640, 812, p.ink)}
${reeds(seeded(23), 1170, 1300, 860, p.ink)}
${wisteria(seeded(11))}
${petals(r, waiting ? 14 : 24, waiting ? 1.5 : 1)}
<rect width="1600" height="1000" fill="url(#vign)"/>
</svg>`
}

// ---------- what the hooks draw ----------

// The working scene never changes. A waiting scene is built once per burst and kept,
// so redraws of the same wait don't rebuild or replay it.
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
    ? 'A crimson night: a swordsman raises his blade as arcs of water and flame sweep around the moon and embers rise: Claude needs you'
    : 'A moonlit river at night under hanging wisteria, with a red bridge, glowing lanterns, fireflies and a swordsman keeping watch: Claude is working'
}
