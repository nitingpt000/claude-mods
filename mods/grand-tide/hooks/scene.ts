import type { Signal } from '../types'

// Grand Tide: a galleon at sunset on the open sea, all original vector art.
//
// While Claude works: sun rays turn slowly behind lit clouds, a lighthouse sweeps its
// beam from a far cliff, layered waves roll and sparkle in the sun's path, gulls glide,
// and a detailed three-masted ship rides the swell under full sail, while a gull rests
// on the old pier posts in the corner.
// When Claude needs you: the sky turns gold, the sails furl, gulls burst from the ship,
// and a treasure map unrolls in the upper right: islands, a sea serpent doodle, a
// turning compass rose, and a dotted route to a glowing red X.
//
// CSS animation only, no script. Each moving part rests where it ends, so reduced
// motion still shows a finished picture. No full-size layer's opacity is animated, and
// nothing scales in an animation.

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

const HORIZON = 600
const SUN = { x: 1210, y: 575, r: 84 }
const SHIP = { x: 300, y: 742, s: 0.95 }
const MAP = { x: 1385, y: 232, s: 0.8 }
const LIGHT = { x: 1530, y: 498 }

type Palette = { sky: string[]; cloud: [string, string, string]; sea: [string, string, string]; glow: number }

const DUSK: Palette = {
  sky: ['#141c48', '#3a3474', '#8a4a82', '#d8686e', '#f59a5c', '#ffc77a'],
  cloud: ['#7a4a7e', '#e08a8e', '#ffd2a0'],
  sea: ['#3a4f8a', '#1e3466', '#0c1838'],
  glow: 0.55,
}
const GOLD: Palette = {
  sky: ['#2a1a48', '#6a3a6a', '#c0566a', '#f07a4a', '#ffb347', '#ffe39a'],
  cloud: ['#a0587a', '#f5a48a', '#ffe6b0'],
  sea: ['#4a6496', '#24406e', '#0e1c3e'],
  glow: 0.8,
}

// ---------- defs ----------

function defs(p: Palette): string {
  const g = (id: string, stops: [number, string, number?][], x2 = 0, y2 = 1) =>
    `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">` +
    stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`).join('') +
    '</linearGradient>'
  const rg = (id: string, stops: [number, string, number?][], extra = '') =>
    `<radialGradient id="${id}"${extra}>` +
    stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`).join('') +
    '</radialGradient>'
  const at = [0, 0.25, 0.5, 0.72, 0.88, 1]
  return (
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="${HORIZON}" gradientUnits="userSpaceOnUse">` +
    p.sky.map((c, i) => `<stop offset="${at[i]}" stop-color="${c}"/>`).join('') +
    '</linearGradient>' +
    rg('sunglow', [[0.2, '#fff0b8', p.glow], [0.55, '#ffb060', p.glow * 0.4], [1, '#ff8a4a', 0]]) +
    rg('sundisk', [[0, '#fffbe8'], [0.7, '#ffe7a6'], [1, '#ffc970']]) +
    `<linearGradient id="ray" x1="0" y1="0" x2="900" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff0c0" stop-opacity="0.16"/><stop offset="0.7" stop-color="#fff0c0" stop-opacity="0.04"/><stop offset="1" stop-color="#fff0c0" stop-opacity="0"/></linearGradient>` +
    g('cloudfill', [[0, p.cloud[0]], [0.6, p.cloud[1]], [1, p.cloud[2]]]) +
    g('streak', [[0, p.cloud[1], 0], [0.4, p.cloud[2], 0.55], [1, p.cloud[1], 0]], 1, 0) +
    g('haze', [[0, '#ffd08a', 0.45], [1, '#ffd08a', 0]]) +
    `<linearGradient id="sea" x1="0" y1="${HORIZON}" x2="0" y2="1000" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${p.sea[0]}"/><stop offset="0.4" stop-color="${p.sea[1]}"/><stop offset="1" stop-color="${p.sea[2]}"/></linearGradient>` +
    g('wave', [[0, '#5a78b0', 0.55], [0.35, p.sea[1], 0.9], [1, p.sea[2]]]) +
    g('shim', [[0, '#ffe2a0', 0], [0.5, '#ffe9b8'], [1, '#ffe2a0', 0]], 1, 0) +
    g('sail', [[0, '#fffaf0'], [0.7, '#efe2c8'], [1, '#c9b48e']], 1, 1) +
    g('hull', [[0, '#7a4424'], [1, '#3a1c0e']]) +
    // The lighthouse beam points left, so its gradient fades from right to left.
    `<linearGradient id="beamL" x1="0" y1="0" x2="-240" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff2c0" stop-opacity="0.45"/><stop offset="1" stop-color="#fff2c0" stop-opacity="0"/></linearGradient>` +
    rg('lamp', [[0, '#fff4c8', 0.95], [1, '#ffd070', 0]]) +
    rg('vign', [[0.6, '#000', 0], [1, '#000', 0.45]], ' cx="0.5" cy="0.45" r="0.78"') +
    g('parch', [[0, '#f3e2b8'], [1, '#dcc08a']], 1, 1) +
    g('roll', [[0, '#a8824a'], [0.5, '#e8cf98'], [1, '#9a7440']], 1, 0) +
    rg('xglow', [[0, '#ff5a3a', 0.6], [1, '#ff5a3a', 0]]) +
    '<path id="spark" d="M0,-6L1.2,-1.2L6,0L1.2,1.2L0,6L-1.2,1.2L-6,0L-1.2,-1.2Z"/>'
  )
}

// ---------- sky ----------

function sun(): string {
  const rays = Array.from({ length: 14 }, (_, i) => {
    const a = i * (360 / 14)
    return `<path d="M0,-4L900,-${i % 2 ? 18 : 32}L900,${i % 2 ? 18 : 32}L0,4Z" fill="url(#ray)" transform="rotate(${n(a)})"/>`
  }).join('')
  return (
    `<g transform="translate(${SUN.x} ${SUN.y})"><g class="rays">${rays}</g></g>` +
    `<circle cx="${SUN.x}" cy="${SUN.y}" r="${SUN.r * 4}" fill="url(#sunglow)"/>` +
    `<circle cx="${SUN.x}" cy="${SUN.y}" r="${SUN.r}" fill="url(#sundisk)"/>`
  )
}

// A cumulus lit from below: a dark base, a body, and a bright rim along the bottom.
function cumulus(x: number, y: number, s: number, p: Palette): string {
  const puffs: [number, number, number][] = [[-90, 14, 34], [-52, -10, 46], [-4, -30, 58], [52, -14, 48], [96, 8, 36], [130, 22, 24], [-120, 26, 22], [10, 18, 44]]
  const body = puffs.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`).join('')
  return (
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    `<g fill="${p.cloud[0]}" opacity="0.9">${body}</g>` +
    `<g fill="url(#cloudfill)" transform="translate(0 6)">${body}</g>` +
    `<path d="M-130,42Q-40,58 60,50T150,40" stroke="${p.cloud[2]}" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.5"/>` +
    '</g>'
  )
}

function clouds(p: Palette): string {
  return (
    `<g class="drift">${cumulus(190, 170, 1.05, p)}${cumulus(1490, 110, 0.7, p)}</g>` +
    `<g class="drift2">${cumulus(560, 300, 0.55, p)}${cumulus(1060, 370, 0.5, p)}</g>` +
    // Long thin streaks near the horizon.
    '<g class="drift3">' +
    '<rect x="-60" y="455" width="700" height="10" rx="5" fill="url(#streak)"/>' +
    '<rect x="160" y="488" width="520" height="7" rx="3.5" fill="url(#streak)"/>' +
    '<rect x="880" y="430" width="760" height="9" rx="4.5" fill="url(#streak)"/>' +
    '<rect x="1000" y="520" width="520" height="6" rx="3" fill="url(#streak)"/>' +
    '</g>'
  )
}

// ---------- land on the horizon ----------

function islands(): string {
  const h = HORIZON
  const palm = (x: number, y: number, s: number, lean: number) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0,0Q${lean},-30 ${lean * 1.4},-60" stroke="#2e2440" stroke-width="4" fill="none"/>` +
    `<g transform="translate(${lean * 1.4} -60)" fill="#2e2440"><path d="M0,0C-14,-8 -30,-4 -38,8C-26,0 -14,0 0,2Z"/><path d="M0,0C14,-10 30,-6 40,6C28,-2 14,-2 0,2Z"/><path d="M0,0C-4,-14 -16,-24 -28,-24C-16,-16 -8,-8 0,0Z"/><path d="M0,0C6,-14 18,-22 30,-20C18,-14 8,-6 0,0Z"/></g></g>`
  return (
    // The far left island, behind the ship.
    `<path d="M600,${h}C640,${h - 30} 700,${h - 40} 760,${h - 18}C790,${h - 8} 820,${h - 2} 840,${h}Z" fill="#3a2c4e"/>` +
    palm(700, h - 36, 0.6, 6) + palm(735, h - 30, 0.5, -8) +
    // The lighthouse cliff on the right.
    `<path d="M1400,${h}C1430,${h - 40} 1470,${h - 86} 1510,${h - 96}L1560,${h - 98}C1590,${h - 80} 1610,${h - 60} 1620,${h - 40}L1620,${h}Z" fill="#3a2c4e"/>` +
    `<path d="M1470,${h - 70}L1490,${h - 40}M1500,${h - 84}L1520,${h - 50}" stroke="#4a3a5e" stroke-width="3"/>` +
    lighthouse()
  )
}

function lighthouse(): string {
  const { x, y } = LIGHT
  return (
    `<g transform="translate(${x} ${y})">` +
    '<path d="M-14,0L14,0L10,-80L-10,-80Z" fill="#efe6d8"/>' +
    '<path d="M-13,-20L13,-20L12.4,-34L-12.4,-34Z" fill="#c0392b"/><path d="M-11.6,-52L11.6,-52L11,-64L-11,-64Z" fill="#c0392b"/>' +
    '<rect x="-14" y="-86" width="28" height="6" fill="#3a2c4e"/>' +
    '<rect x="-8" y="-102" width="16" height="16" fill="#fff4c8"/>' +
    '<path d="M-12,-102L0,-114L12,-102Z" fill="#3a2c4e"/>' +
    '<circle cy="-94" r="30" fill="url(#lamp)" class="flicker"/>' +
    // The beam sweeps out over the sea and back.
    '<g transform="translate(0 -94)"><g class="sweep"><path d="M0,-3L-240,-18L-240,18L0,3Z" fill="url(#beamL)"/></g></g>' +
    '</g>'
  )
}

// ---------- the sea ----------

function waveBand(y: number, amp: number, len: number, cls: string, fill: string, crest: string, op: number): string {
  let d = `M${-2 * len},${y}`
  for (let x = -2 * len; x < 1600 + 2 * len; x += len) d += `Q${x + len / 4},${y - amp} ${x + len / 2},${y}T${x + len},${y}`
  return (
    `<g class="${cls}"><path d="${d}L${1600 + 2 * len},1000L${-2 * len},1000Z" fill="${fill}" opacity="${op}"/>` +
    `<path d="${d}" fill="none" stroke="${crest}" stroke-width="2.2" stroke-linecap="round" opacity="0.55"/></g>`
  )
}

function sea(r: Random): string {
  let shim = ''
  for (let i = 0; i < 12; i++) {
    const w = 190 - i * 13
    shim += `<rect class="glint" x="${n(SUN.x - w / 2 + r.pick(-10, 10))}" y="${HORIZON + 6 + i * 16}" width="${w}" height="${i < 4 ? 4 : 3}" rx="2" style="animation-delay:-${n(i * 0.4)}s"/>`
  }
  let sparks = ''
  for (let i = 0; i < 18; i++) {
    const x = SUN.x + r.pick(-170, 170)
    const y = r.pick(HORIZON + 20, 860)
    sparks += `<use href="#spark" transform="translate(${n(x)} ${n(y)}) scale(${n(r.pick(0.5, 1.2))})" class="tw" style="animation-delay:-${n(r.pick(0, 5))}s"/>`
  }
  return (
    `<rect y="${HORIZON}" width="1600" height="${1000 - HORIZON}" fill="url(#sea)"/>` +
    `<rect y="${HORIZON - 30}" width="1600" height="60" fill="url(#haze)"/>` +
    `<g fill="url(#shim)">${shim}</g>` +
    waveBand(660, 7, 180, 'wave4', 'url(#wave)', '#c8d8ff', 0.55) +
    waveBand(720, 10, 220, 'wave3', 'url(#wave)', '#d8e4ff', 0.7) +
    `<g fill="#fff3c8">${sparks}</g>`
  )
}

function nearWaves(): string {
  return (
    waveBand(830, 14, 260, 'wave2', 'url(#wave)', '#e4ecff', 0.85) +
    waveBand(920, 18, 300, 'wave1', 'url(#wave)', '#eef3ff', 1)
  )
}

// ---------- the ship ----------

function ship(waiting: boolean): string {
  // Facing right. Stern castle at the left, bowsprit at the right.
  const hull =
    'M-190,-40L-120,-40L-112,-22L150,-22Q196,-26 222,-46L214,-30Q196,24 132,48L-128,48Q-176,30 -190,-40Z'
  const windows = [-176, -162, -148, -134].map(x => `<rect x="${x}" y="-34" width="8" height="10" rx="1.5" fill="#ffcf6a"/>`).join('')
  const ports = [-90, -50, -10, 30, 70, 110].map(x => `<rect x="${x}" y="2" width="12" height="9" rx="1" fill="#1e0e06"/>`).join('')
  const masts =
    '<g stroke="#3a1c0e" stroke-linecap="round">' +
    '<line x1="-80" y1="-22" x2="-80" y2="-230" stroke-width="7"/>' +
    '<line x1="16" y1="-22" x2="16" y2="-262" stroke-width="8"/>' +
    '<line x1="104" y1="-22" x2="104" y2="-214" stroke-width="6"/>' +
    '<line x1="210" y1="-40" x2="300" y2="-96" stroke-width="5"/>' +
    // Yards.
    '<g stroke-width="4"><line x1="-124" y1="-196" x2="-36" y2="-196"/><line x1="-116" y1="-122" x2="-44" y2="-122"/>' +
    '<line x1="-34" y1="-232" x2="66" y2="-232"/><line x1="-44" y1="-146" x2="76" y2="-146"/>' +
    '<line x1="62" y1="-186" x2="146" y2="-186"/><line x1="56" y1="-112" x2="152" y2="-112"/></g>' +
    '</g>'
  const rigging =
    '<g stroke="#2a1608" stroke-width="1.2" opacity="0.8" fill="none">' +
    '<path d="M300,-96L104,-214M300,-96L16,-262M210,-40L104,-170M-190,-40L-80,-230M-190,-40L16,-262"/>' +
    // Shrouds down to the rails.
    '<path d="M-80,-200L-110,-26M-80,-200L-50,-26M16,-240L-20,-24M16,-240L52,-24M104,-190L80,-24M104,-190L128,-26"/>' +
    '</g>'
  // Square sails bellied forward, with a shadow down one side.
  const sq = (cx: number, top: number, w: number, h: number) =>
    `<path d="M${cx - w / 2},${top}L${cx + w / 2},${top}Q${cx + w / 2 + 12},${top + h / 2} ${cx + w / 2 - 4},${top + h}L${cx - w / 2 + 4},${top + h}Q${cx - w / 2 + 14},${top + h / 2} ${cx - w / 2},${top}Z" fill="url(#sail)"/>`
  const sails = waiting
    ? // Furled along the yards.
      '<g fill="#efe2c8">' +
      ['-124,-200,88', '-116,-126,72', '-34,-236,100', '-44,-150,120', '62,-190,84', '56,-116,96'].map(s => {
        const [x, y, w] = s.split(',').map(Number)
        return `<rect x="${x}" y="${y}" width="${w}" height="9" rx="4.5"/>`
      }).join('') +
      '</g>'
    : sq(-80, -194, 84, 66) + sq(-80, -120, 70, 80) + sq(16, -230, 96, 78) + sq(16, -144, 116, 104) + sq(104, -184, 80, 66) + sq(104, -110, 92, 76) +
      // Jibs to the bowsprit.
      '<path d="M296,-92L108,-206L132,-70Z" fill="url(#sail)" opacity="0.95"/><path d="M262,-74L112,-150L120,-56Z" fill="url(#sail)" opacity="0.9"/>'
  return (
    `<g transform="translate(${SHIP.x} ${SHIP.y}) scale(${SHIP.s})"><g class="ride">` +
    // Foam where the hull meets the water and the wake behind.
    '<path d="M-200,44C-260,52 -330,48 -400,40" stroke="#eef3ff" stroke-width="4" fill="none" opacity="0.55" class="wake"/>' +
    '<path d="M-190,52C-240,62 -300,62 -360,56" stroke="#eef3ff" stroke-width="2.5" fill="none" opacity="0.4" class="wake"/>' +
    rigging +
    masts +
    sails +
    `<path d="${hull}" fill="url(#hull)"/>` +
    // Planking, gold trim, and the warm rim of the sun on the hull's top.
    '<path d="M-176,-4L190,-4M-166,22L170,18M-150,38L140,36" stroke="#2a1408" stroke-width="1.5" opacity="0.6"/>' +
    '<path d="M-120,-22L150,-22Q196,-26 222,-46" stroke="#d8a64a" stroke-width="3" fill="none"/>' +
    '<path d="M-190,-40L-120,-40" stroke="#d8a64a" stroke-width="3"/>' +
    windows +
    ports +
    '<rect x="4" y="-270" width="26" height="10" rx="2" fill="#3a1c0e"/>' +
    // A red pennant at the top and a small flag at the stern.
    `<g transform="translate(16 -262)"><g class="flag${waiting ? ' fastflag' : ''}"><path d="M0,0C20,2 34,8 56,6C36,12 20,16 0,18Z" fill="#d8352a"/></g></g>` +
    `<g transform="translate(-190 -40)"><line y2="-46" stroke="#3a1c0e" stroke-width="3"/><g transform="translate(0 -46)"><g class="flag" style="animation-delay:-0.6s"><path d="M0,0L-30,4L-30,20L0,16Z" fill="#2a5aa8"/></g></g></g>` +
    '</g></g>'
  )
}

// ---------- the pier in the corner ----------

function pier(): string {
  const post = (x: number, top: number, w: number) =>
    `<rect x="${x - w / 2}" y="${top}" width="${w}" height="${1000 - top}" fill="#2a1a12"/>` +
    `<rect x="${x - w / 2}" y="${top}" width="${w}" height="6" fill="#4a3020"/>` +
    `<path d="M${x - w / 2},${top + 20}L${x + w / 2},${top + 26}" stroke="#4a3020" stroke-width="2"/>`
  return (
    post(1470, 830, 26) +
    post(1540, 800, 30) +
    post(1592, 846, 24) +
    // Rope between the posts.
    '<path d="M1483,846Q1508,874 1525,820M1555,820Q1574,866 1580,864" stroke="#8a6a44" stroke-width="3" fill="none"/>' +
    // A gull resting on the tall post.
    '<g transform="translate(1540 800)"><path d="M-16,-2C-14,-14 -2,-18 8,-16C14,-15 18,-20 22,-18C24,-14 20,-10 16,-10L14,-2Z" fill="#f2efe8"/>' +
    '<path d="M-14,-6C-6,-12 6,-12 12,-8C4,-6 -6,-4 -14,-6Z" fill="#8a8a96"/><path d="M22,-17L28,-15L22,-14Z" fill="#f0a030"/><circle cx="17" cy="-15" r="1.2" fill="#111"/>' +
    '<path d="M-4,-2V0M4,-2V0" stroke="#f0a030" stroke-width="2"/></g>'
  )
}

// ---------- gulls ----------

// A gull whose wings flap by rotating about the body: no scaling.
function gullShape(d: number): string {
  return (
    '<path d="M-3,0C-1,-2 1,-2 3,0C1,1 -1,1 -3,0Z" fill="#2a2234"/>' +
    `<g class="wl" style="animation-delay:-${d}s"><path d="M-2,0C-6,-6 -12,-7 -18,-3C-12,-4 -7,-2 -2,1Z" fill="#2a2234"/></g>` +
    `<g class="wr" style="animation-delay:-${d}s"><path d="M2,0C6,-6 12,-7 18,-3C12,-4 7,-2 2,1Z" fill="#2a2234"/></g>`
  )
}

function gulls(r: Random, burst: boolean): string {
  let out = ''
  const count = burst ? 10 : 7
  for (let i = 0; i < count; i++) {
    const x = burst ? SHIP.x + r.pick(-60, 60) : r.pick(80, 1550)
    const y = burst ? SHIP.y - 240 * SHIP.s : r.pick(110, 420)
    const dur = burst ? r.pick(5, 9) : r.pick(18, 30)
    const cls = burst ? `burst b${i}` : 'glide'
    out +=
      `<g transform="translate(${n(x)} ${n(y)})"><g class="${cls}" style="animation-duration:${n(dur)}s;animation-delay:-${n(r.pick(0, burst ? 0.4 : dur))}s">` +
      `<g transform="scale(${n(r.pick(0.9, 1.6))})">${gullShape(n(r.pick(0, 1)))}</g></g></g>`
  }
  return out
}

function burstKeyframes(r: Random): string {
  let css = ''
  for (let i = 0; i < 10; i++) {
    const dx = n(r.pick(-240, 860))
    const dy = n(-r.pick(160, 500))
    css += `.b${i}{animation-name:b${i};animation-timing-function:ease-out;animation-iteration-count:infinite}@keyframes b${i}{from{transform:translate(0px,0px)}to{transform:translate(${dx}px,${dy}px)}}`
  }
  return css
}

// ---------- the treasure map ----------

function map(r: Random): { css: string; svg: string } {
  const pts: [number, number][] = [[-150, 72]]
  for (let i = 1; i < 5; i++) pts.push([n(-150 + i * 58 + r.pick(-10, 10)), n(72 - i * 26 + r.pick(-34, 34))])
  const X = { x: 118, y: -58 }
  pts.push([X.x - 14, X.y + 12])
  let route = `M${pts[0]![0]},${pts[0]![1]}`
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1]!
    const [cx, cy] = pts[i]!
    route += `Q${n((px + cx) / 2 + r.pick(-20, 20))},${n((py + cy) / 2 + r.pick(-30, 30))} ${cx},${cy}`
  }
  const rose = Array.from({ length: 8 }, (_, i) => {
    const long = i % 2 === 0
    const a = (i * 45 * Math.PI) / 180
    const L = long ? 34 : 20
    const w = long ? 7 : 5
    const tip = [Math.sin(a) * L, -Math.cos(a) * L]
    const left = [Math.sin(a - Math.PI / 2) * w, -Math.cos(a - Math.PI / 2) * w]
    const right = [Math.sin(a + Math.PI / 2) * w, -Math.cos(a + Math.PI / 2) * w]
    return `<path d="M${n(left[0]!)},${n(left[1]!)}L${n(tip[0]!)},${n(tip[1]!)}L${n(right[0]!)},${n(right[1]!)}Z" fill="${i === 0 ? '#b8322a' : long ? '#5a3a1e' : '#9a7a50'}"/>`
  }).join('')
  const peaks = (x: number, y: number) => `<path d="M${x - 12},${y}L${x - 4},${y - 12}L${x + 4},${y}M${x},${y}L${x + 8},${y - 10}L${x + 16},${y}" stroke="#7a5a32" stroke-width="1.6" fill="none"/>`
  const sparks = [[-26, -30], [30, -34], [34, 20], [-30, 22]]
    .map(([dx, dy], i) => `<use href="#spark" transform="translate(${X.x + dx!} ${X.y + dy!}) scale(0.9)" class="tw" style="animation-delay:-${i * 0.6}s"/>`)
    .join('')
  return {
    css: '.route{stroke-dasharray:7 9;}',
    svg:
      `<g transform="translate(${MAP.x} ${MAP.y}) scale(${MAP.s})"><g class="unroll">` +
      '<rect x="-214" y="-146" width="436" height="300" rx="6" fill="#000" opacity="0.25" transform="translate(8 10)"/>' +
      '<path d="M-210,-150L210,-150L210,150L-210,150Z" fill="url(#parch)"/>' +
      // Burnt, uneven edge.
      '<path d="M-210,-150L-160,-146L-100,-152L-30,-147L40,-153L120,-147L210,-150M-210,150L-150,146L-60,152L30,147L110,152L210,150" stroke="#9a6a34" stroke-width="3" fill="none" opacity="0.7"/>' +
      '<rect x="-230" y="-162" width="28" height="324" rx="14" fill="url(#roll)"/>' +
      '<rect x="202" y="-162" width="28" height="324" rx="14" fill="url(#roll)"/>' +
      // Sea hatching.
      '<g stroke="#a8884f" stroke-width="1.2" opacity="0.55"><path d="M-170,10q8,-5 16,0t16,0M-60,120q8,-5 16,0t16,0M150,60q8,-5 16,0t16,0M-20,-130q8,-5 16,0t16,0M60,110q8,-5 16,0t16,0"/></g>' +
      // Islands.
      '<path d="M-182,-118C-120,-140 -56,-112 -40,-72C-24,-30 -72,-10 -124,-20C-176,-30 -204,-80 -182,-118Z" fill="#d6b77c" stroke="#7a5a32" stroke-width="2"/>' +
      '<path d="M56,-116C120,-136 184,-104 182,-42C180,10 128,30 78,8C36,-12 16,-84 56,-116Z" fill="#d6b77c" stroke="#7a5a32" stroke-width="2"/>' +
      '<path d="M-64,56C-22,36 42,46 52,86C42,118 -22,122 -54,98Z" fill="#d6b77c" stroke="#7a5a32" stroke-width="2"/>' +
      peaks(-120, -70) + peaks(-96, -50) + peaks(150, -20) +
      // A palm on the treasure island.
      '<path d="M84,-90V-74M84,-90C78,-96 70,-94 66,-88M84,-90C90,-97 98,-95 102,-89" stroke="#5a3a1e" stroke-width="2" fill="none"/>' +
      // A sea serpent doodle.
      '<path d="M-150,110c8,-14 16,-14 22,0c6,14 14,14 22,0c8,-14 16,-14 22,0" stroke="#6a4a2a" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="-150" cy="108" r="4" fill="#6a4a2a"/>' +
      // Route, start ship, the X.
      `<path class="route reveal" d="${route}" fill="none" stroke="#7a3a1e" stroke-width="3" stroke-linecap="round"/>` +
      '<path d="M-164,76L-136,76L-141,83L-159,83Z" fill="#5a2e18"/><path d="M-150,76V60L-141,74Z" fill="#7a3a1e"/>' +
      `<g transform="translate(${X.x} ${X.y})"><circle r="34" fill="url(#xglow)" class="pulse"/>` +
      '<path d="M-13,-13L13,13M13,-13L-13,13" stroke="#c0281e" stroke-width="6.5" stroke-linecap="round"/></g>' +
      `<g fill="#ffb347">${sparks}</g>` +
      // Compass rose with its N.
      '<g transform="translate(150 98)"><g class="rose">' +
      '<circle r="28" fill="none" stroke="#5a3a1e" stroke-width="1.5"/><circle r="22" fill="none" stroke="#5a3a1e" stroke-width="0.8"/>' +
      rose +
      '</g><text y="-34" font-size="12" font-weight="700" text-anchor="middle" fill="#5a3a1e" font-family="Georgia,serif">N</text></g>' +
      '</g></g>',
  }
}

// ---------- composing ----------

const CSS = `
.rays { animation: rays 120s linear infinite; transform-origin: 0 0; }
@keyframes rays { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.drift { animation: drift 60s ease-in-out infinite alternate; }
.drift2 { animation: drift2 80s ease-in-out infinite alternate; }
.drift3 { animation: drift 90s ease-in-out infinite alternate; }
@keyframes drift { from { transform: translateX(-50px); } to { transform: translateX(60px); } }
@keyframes drift2 { from { transform: translateX(40px); } to { transform: translateX(-60px); } }
.flicker { animation: flicker 2.4s ease-in-out infinite alternate; }
@keyframes flicker { from { opacity: 0.65; } to { opacity: 1; } }
.sweep { animation: sweep 9s ease-in-out infinite alternate; transform-origin: 0 0; }
@keyframes sweep { from { transform: rotate(-4deg); } to { transform: rotate(-22deg); } }
.glint { animation: glint 2.8s ease-in-out infinite alternate; }
@keyframes glint { from { opacity: 0.3; } to { opacity: 0.95; } }
.tw { animation: tw 3s ease-in-out infinite alternate; }
@keyframes tw { from { opacity: 0.15; } to { opacity: 1; } }
.wave1 { animation: w1 10s linear infinite; }
.wave2 { animation: w2 14s linear infinite reverse; }
.wave3 { animation: w3 18s linear infinite; }
.wave4 { animation: w4 24s linear infinite reverse; }
@keyframes w1 { from { transform: translateX(0px); } to { transform: translateX(-300px); } }
@keyframes w2 { from { transform: translateX(0px); } to { transform: translateX(-260px); } }
@keyframes w3 { from { transform: translateX(0px); } to { transform: translateX(-220px); } }
@keyframes w4 { from { transform: translateX(0px); } to { transform: translateX(-180px); } }
.ride { animation: ride 4.5s ease-in-out infinite alternate; transform-origin: 0px 40px; }
@keyframes ride { from { transform: translateY(-5px) rotate(-2deg); } to { transform: translateY(5px) rotate(2deg); } }
.wake { animation: wake 3s ease-in-out infinite alternate; }
@keyframes wake { from { opacity: 0.2; } to { opacity: 0.6; } }
.flag { animation: flag 1.4s ease-in-out infinite alternate; transform-origin: 0 0; }
.fastflag { animation-duration: 0.6s; }
@keyframes flag { from { transform: rotate(-6deg); } to { transform: rotate(8deg); } }
.glide { animation: glide 24s linear infinite; }
@keyframes glide { 0% { transform: translate(-120px, 0px); } 50% { transform: translate(0px, -30px); } 100% { transform: translate(120px, 0px); } }
.wl { animation: wl 0.7s ease-in-out infinite alternate; transform-origin: -2px 0px; }
.wr { animation: wr 0.7s ease-in-out infinite alternate; transform-origin: 2px 0px; }
@keyframes wl { from { transform: rotate(-18deg); } to { transform: rotate(22deg); } }
@keyframes wr { from { transform: rotate(18deg); } to { transform: rotate(-22deg); } }
`

const WAIT_CSS = `
.unroll { animation: unroll 1.2s ease-out 1; }
@keyframes unroll { from { opacity: 0; transform: translateY(-24px); } to { opacity: 1; transform: translateY(0px); } }
.reveal { animation: reveal 2.6s ease-in-out 1; }
@keyframes reveal { from { opacity: 0; } to { opacity: 1; } }
.pulse { animation: pulse 1.8s ease-in-out infinite alternate; }
@keyframes pulse { from { opacity: 0.35; } to { opacity: 1; } }
.rose { animation: rose 40s linear infinite; transform-origin: 0 0; }
@keyframes rose { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`

const STILLED =
  '.rays, .drift, .drift2, .drift3, .flicker, .sweep, .glint, .tw, .wave1, .wave2, .wave3, .wave4, .ride, .wake, .flag, .glide, .wl, .wr, .unroll, .reveal, .pulse, .rose, .burst'

export function build(waiting: boolean, burst: number): string {
  const p = waiting ? GOLD : DUSK
  const r = seeded(waiting ? burst : 1999)
  const m = waiting ? map(r) : undefined
  const burstCss = waiting ? burstKeyframes(r) : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<defs>${defs(p)}</defs>
<style>
${CSS}${m ? WAIT_CSS + m.css + burstCss : ''}
@media (prefers-reduced-motion: reduce) { ${STILLED} { animation: none; } }
</style>
<rect width="1600" height="${HORIZON + 2}" fill="url(#sky)"/>
${sun()}
${clouds(p)}
${islands()}
${sea(seeded(9))}
${gulls(seeded(3), false)}
${ship(waiting)}
${nearWaves()}
${pier()}
${waiting ? gulls(r, true) : ''}
${m ? m.svg : ''}
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
    ? 'A golden sunset: the ship furls its sails, gulls scatter and a treasure map unrolls with a route to a glowing X: Claude needs you'
    : 'A galleon under full sail rides the swell at sunset, with gulls, a lighthouse and sparkling water: Claude is working'
}
