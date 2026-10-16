// Building blocks for the gallery designs (hub/designs/src). Each helper returns a plain layout
// node the store validates and the phone's LayoutRenderer draws; nothing here runs on the phone.

// Minerva's per-app palettes from the concept board (light, then dark).
export const PAL = {
  mail: ['#ffffff #111111 #5e5e5e #9b1b30 #f4f4f4', '#121212 #ececec #a0a0a0 #e0687c #1f1f1f'],
  office: ['#ffffff #1d1d1f #6e6e73 #1d1d1f #b9b8c4', '#1c1c1e #f5f5f7 #a1a1a6 #f5f5f7 #55545e'],
  olympus: ['#ffffff #1d1d1f #6e6e73 #d4604a #f5f5f7', '#1c1c1e #f5f5f7 #a1a1a6 #e2705a #2c2c2e'],
  lucid: ['#ffffff #0f1b2a #5c6b7a #1b7fd6 #eef5fc', '#141a21 #eef3f8 #9aa7b4 #5eb1ff #1f2731'],
  hq: ['#ffffff #1d1d1f #6e6e73 #6e56cf #f3f1fb', '#18171d #f5f5f7 #a1a1a6 #a594ff #26242e'],
  argus: ['#f4f4f1 #141414 #5f5f5a #141414 #e6e6e1', '#0f100f #e6e8e3 #9a9d96 #e6e8e3 #1d1f1d'],
  vesta: ['#fbfbf6 #1b2117 #5f6758 #4c7a35 #edf1e5', '#151912 #eef2e8 #a3ab9b #9bcc7f #20261c'],
  taxes: ['#fff8ec #2a1f10 #6f604b #a85d00 #f4e6cf', '#1d1810 #f6ecdc #b3a58f #ffb547 #2b2318'],
  cura: ['#ffffff #1d1d1f #6e6e73 #c2416b #f7eef1', '#1d1a1c #f5f5f7 #a1a1a6 #ff7aa2 #2b2428'],
  tv: ['#ffffff #1d1d1f #6e6e73 #1d1d1f #f5f5f7', '#1c1c1e #f5f5f7 #a1a1a6 #f5f5f7 #2c2c2e'],
  keled: ['#ffffff #1d1d1f #6e6e73 #1d1d1f #f2f2f4', '#1c1c1e #f5f5f7 #a1a1a6 #f5f5f7 #2c2c2e'],
}

const colors = (s) => {
  const [bg, ink, muted, accent, tile] = s.split(' ')
  return { bg: [bg], ink, muted, accent, tile }
}

export const theme = (app, extra = {}) => {
  const [l, d] = PAL[app]
  return { ...colors(l), dark: colors(d), ...extra }
}

// White type over one of his photos; the photo is the container background, so Clear and
// tinted Home Screens drop it like any other background and keep the type.
const PHOTO = { bg: ['#141414'], ink: '#ffffff', muted: '#ffffffc7', accent: '#ffffff', tile: '#ffffff29' }
export const photoTheme = (image) => ({ ...PHOTO, image, dark: { ...PHOTO } })

const FAM = { sys: undefined, rd: 'rounded', se: 'serif', mo: 'mono' }
const W = { 300: 'light', 400: 'regular', 500: 'medium', 600: 'semibold', 700: 'bold', 800: 'heavy' }
const clean = (o) => { for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; return o }

/** Text in Minerva's terms: size, weight, family (sys, rd rounded, se serif, mo mono). */
export const t = (text, size, w = 600, fam = 'sys', o = {}) =>
  clean({ type: 'text', text, size, weight: W[w], design: FAM[fam], ...o })
/** Her M(): muted, medium weight. */
export const m = (text, size, o = {}) => t(text, size, 500, 'sys', { color: 'muted', ...o })

export const V = (children, o = {}) => ({ type: 'vstack', align: 'leading', spacing: 0, children: children.filter(Boolean), ...o })
export const H = (children, o = {}) => ({ type: 'hstack', spacing: 0, children: children.filter(Boolean), ...o })
export const Z = (children, o = {}) => ({ type: 'zstack', children: children.filter(Boolean), ...o })
export const sp = (minLength) => (minLength === undefined ? { type: 'spacer' } : { type: 'spacer', minLength })
export const gap = (height) => ({ type: 'spacer', minLength: height, height })
export const div = (o = {}) => ({ type: 'divider', color: 'line', ...o })
export const mark = (value, size = 14, o = {}) => ({ type: 'mark', value, size, ...o })
export const cv = (w, h, children, o = {}) => ({ type: 'canvas', box: [w, h], width: w, height: h, children: children.filter(Boolean), ...o })
export const img = (src, w, h, o = {}) => ({ type: 'image', src, width: w, height: h, fit: 'fill', full: true, ...o })

// SF Symbols for Minerva's stroke icons.
export const ICON = {
  env: 'envelope', tag: 'tag', bldg: 'building.2', qbub: 'questionmark.bubble', bub: 'bubble.left',
  cols: 'building.columns', net: 'network', cal: 'calendar', doc: 'doc.text',
  nodes: 'point.3.connected.trianglepath.dotted', sparkle: 'sparkles', tv: 'tv', stack: 'square.stack',
  run: 'figure.run', pan: 'fork.knife', bike: 'bicycle', clock: 'clock', ball: 'soccerball', check: 'checkmark',
}
export const ic = (name, size = 16, o = {}) => ({ type: 'symbol', name: ICON[name] ?? name, size, weight: 'regular', color: 'ink', ...o })
/** "{@envelope}" inline glyph for one-line text. */
export const glyph = (name) => `{@${ICON[name] ?? name}}`

/** Home and iPad designs: padded, filling the widget, laid out from the top left. */
export const root = (children, o = {}) => V(children, { padding: [16], maxW: true, maxH: true, frameAlign: 'topLeading', ...o })
/** Lock screen designs fill their slot, centred. */
export const lockRoot = (child, o = {}) => ({ ...child, maxW: true, maxH: true, frameAlign: o.frameAlign ?? 'center', ...o })

/** A Kel face: portrait in colour, kept in colour on Clear and tinted Home Screens (his ask);
 * the initial shows through until the portrait has loaded. Busy: full strength with a green ring;
 * idle: half strength. */
const portrait = (size, opacity, when) => Z([
  { type: 'circle', color: 'tile', width: size, height: size },
  t('{item.initial}', Math.round(size * 0.42), 600, 'rd', { color: 'muted' }),
  img('{item.image}', size, size, { radius: size / 2 }),
], { width: size, height: size, opacity, when })
export const face = (size, o = {}) => Z([
  { type: 'circle', stroke: 'ok', strokeWidth: size > 40 ? 2.5 : 2, width: size + 8, height: size + 8, when: '{item.on}' },
  portrait(size, 1, '{item.on}'),
  portrait(size, 0.5, '!{item.on}'),
], { width: size + 8, height: size + 8, ...o })

/** Lock-screen stand-in for a face: an initial in a ring, filled when that Kel is working. */
export const disc = (size, o = {}) => Z([
  { type: 'circle', stroke: 'muted', strokeWidth: size > 40 ? 2 : 1.5, width: size, height: size, when: '!{item.on}' },
  t('{item.initial}', Math.round(size * 0.42), 600, 'rd', { color: 'muted', when: '!{item.on}' }),
  { type: 'circle', color: 'ink', width: size, height: size, when: '{item.on}' },
  t('{item.initial}', Math.round(size * 0.42), 600, 'rd', { knock: true, when: '{item.on}' }),
], { width: size, height: size, ...o })

/** Minerva's habit button: a thin accent ring with the habit's glyph at 54%, filled once done. Taps toggle it. */
export const habit = (size, o = {}) => ({ type: 'check', style: 'glyph', size, scale: 0.54, action: '{item.action}', symbol: '{item.symbol}', color: 'accent', line: 1.7, ...o })

/** Idle mark: a small dashed circle. */
export const idle = (size = 9) => ({ type: 'circle', stroke: 'muted', strokeWidth: 1.3, dash: [2, 1.8], width: size, height: size })

let counter = 0
export const design = (n, name, group, family, device, cards, layout, o = {}) => {
  counter = n
  return clean({ id: `w${String(n).padStart(2, '0')}`, n, name, group, family, device, cards, layout, ...o })
}
export const last = () => counter
