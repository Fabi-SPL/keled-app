// Card store for the Keled widgets. One JSON file per card, written atomically,
// so the CLI, the feeds and the HTTP server can all write without a lock.
// Themes (hub/themes/<name>.json) and image assets (hub/assets) live in the repo:
// they are design, and design is versioned. Cards are data and stay in hub/data.

import { mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const DATA_DIR = process.env.KELED_WIDGETS_DATA || join(HERE, 'data')
export const THEMES_DIR = process.env.KELED_WIDGETS_THEMES || join(HERE, 'themes')
export const ASSETS_DIR = process.env.KELED_WIDGETS_ASSETS || join(HERE, 'assets')
const CARDS = () => join(DATA_DIR, 'cards')

// How often the phone should ask again, in seconds. iOS will not reload a widget sooner than
// about 5 minutes and spreads 40-70 reloads a day per widget, so 300 is the floor and the
// default stays at 15 minutes. "5m", "30m", "1h" and plain seconds are all accepted.
export const REFRESH_MIN = 300
export const REFRESH_MAX = 86400
function refreshOf(v, errors) {
  if (v === undefined || v === null || v === '') return undefined
  const m = String(v).trim().match(/^(\d+(?:\.\d+)?)\s*(s|m|h)?$/i)
  if (!m) { errors.push('refresh: seconds, or like "5m" / "1h"'); return undefined }
  const sec = Math.round(Number(m[1]) * ({ s: 1, m: 60, h: 3600 }[(m[2] || 's').toLowerCase()]))
  return Math.min(REFRESH_MAX, Math.max(REFRESH_MIN, sec))
}

export const KINDS = ['metric', 'list', 'gauge', 'status', 'spark']
export const TINTS = ['accent', 'ok', 'warn', 'bad', 'neutral']
export const FAMILIES = ['small', 'medium', 'large', 'xl', 'circular', 'rectangular', 'inline']
export const NODE_TYPES = ['vstack', 'hstack', 'zstack', 'text', 'symbol', 'image', 'spacer', 'divider', 'rect', 'circle',
  'ring', 'bar', 'spark', 'date', 'button', 'check', 'link', 'each', 'grid', 'bars', 'mark', 'canvas',
  // Shapes inside a canvas, drawn in its box units:
  'path', 'arcs', 'rays', 'gauge', 'repeat']
const CONTAINERS = new Set(['vstack', 'hstack', 'zstack', 'button', 'link', 'each', 'grid', 'canvas'])
const COLOR_TOKENS = ['ink', 'muted', 'accent', 'bg', 'tile', 'tint', 'ok', 'warn', 'bad', 'neutral', 'white', 'black', 'clear', 'line', 'fill', 'on']
const WEIGHTS = ['ultralight', 'thin', 'light', 'regular', 'medium', 'semibold', 'bold', 'heavy', 'black']
const DESIGNS = ['system', 'rounded', 'serif', 'mono', 'numbers']
export const ID = /^[a-z0-9][a-z0-9-]{0,47}$/
export const ASSET = /^[a-z0-9][a-z0-9-]{0,47}\.(png|jpg|jpeg)$/
// An action reference: handler name, optionally ":arg". The arg alphabet has no quotes, slashes or
// spaces, so substituting it into a URL, a JSON body or an argv can never change their shape.
export const ACTION_REF = /^([a-z0-9][a-z0-9_-]{0,31})(?::([A-Za-z0-9._~-]{1,80}))?$/
const HEX = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i
const TEMPLATE = /^\{[A-Za-z0-9_.]+\}$/
const MAX_DEPTH = 10
const MAX_NODES = 160
const MAX_DESIGN_NODES = 400

const str = (v, max) => {
  if (v === undefined || v === null || v === '') return undefined
  const s = String(v).replace(/\s+/g, ' ').trim()
  if (s.length <= max) return s
  // Cut at a word boundary with an ellipsis, so a widget never shows "neares".
  const cut = s.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${space > max * 0.6 ? cut.slice(0, space) : cut}…`
}
const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v))
const bool = (v) => (v === undefined || v === null ? undefined : v === true || v === 'true' || v === 1)
const clean = (o) => { for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; return o }
export const slug = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)

// "ink", "#1b1b1f", "accent@0.4", "{item.tint}" are colours; anything else is a typo.
function color(v, path, errors) {
  if (v === undefined || v === null || v === '') return undefined
  const s = String(v).trim()
  const [base, alpha, extra] = s.split('@')
  const okAlpha = alpha === undefined || (alpha !== '' && Number(alpha) >= 0 && Number(alpha) <= 1)
  if (extra === undefined && okAlpha && (HEX.test(base) || COLOR_TOKENS.includes(base) || TEMPLATE.test(base))) return s
  errors.push(`${path}: "${s}" is not a colour (hex, ${COLOR_TOKENS.join('/')}, or {template}, optional @0..1)`)
  return undefined
}

function oneOf(v, list, path, errors) {
  if (v === undefined || v === null || v === '') return undefined
  if (list.includes(v)) return v
  errors.push(`${path}: "${v}" must be one of ${list.join(', ')}`)
  return undefined
}

function linkUrl(v, path, errors) {
  const s = str(v, 500)
  if (!s) return undefined
  if (/^(https?|keled):\/\//.test(s) || TEMPLATE.test(s)) return s
  errors.push(`${path}: url must start with https://, http:// or keled://`)
  return undefined
}

const NODE_STR = { text: 200, name: 64, src: 60, value: 60, series: 40, date: 60, style: 16, of: 16, action: 120,
  when: 80, family: 48, align: 16, frameAlign: 16, fit: 8, label: 40, symbol: 64, d: 600, test: 80, start: 60, card: 48, count: 40 }
const NODE_NUM = { limit: [1, 16], size: [4, 160], line: [0.5, 30], lines: [1, 12], scale: [0.2, 1], tracking: [-5, 20],
  spacing: [0, 80], radius: [0, 80], strokeWidth: [0, 10], width: [0, 1000], height: [0, 1000], opacity: [0, 1], minLength: [0, 200],
  total: [1, 60], columns: [1, 12], cap: [0, 1e9], x: [-1000, 1000], y: [-1000, 1000], r: [0, 500], from: [-720, 720], to: [-720, 720],
  rowSpacing: [0, 80] }
const NODE_BOOL = ['upper', 'italic', 'mono', 'privacy', 'accent', 'maxW', 'maxH', 'full', 'knock']
const NODE_NUMS = { box: [2, 2], dash: [1, 4] }
const NODE_COLOR = ['color', 'track', 'bg', 'stroke']

// A layout is a tree the widget draws natively. Unknown keys are dropped; bad values are errors,
// so a session finds its typo at put time instead of on the phone.
export function normalizeNode(input, path, errors, state = { count: 0 }, depth = 0) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) { errors.push(`${path}: node must be an object`); return undefined }
  if (depth > MAX_DEPTH) { errors.push(`${path}: deeper than ${MAX_DEPTH} levels`); return undefined }
  const max = state.max ?? MAX_NODES
  if (++state.count > max) { if (state.count === max + 1) errors.push(`${path}: more than ${max} nodes`); return undefined }
  const type = oneOf(input.type, NODE_TYPES, `${path}.type`, errors)
  if (!type) { if (!input.type) errors.push(`${path}: type is required`); return undefined }
  const node = { type }
  for (const [k, max] of Object.entries(NODE_STR)) {
    // text keeps its whitespace; a date's label keeps its edges so "UStVA in " meets the number with a space.
    if (input[k] !== undefined) node[k] = k === 'text' ? String(input[k]).slice(0, max) : k === 'label' && input.type === 'date' ? String(input[k]).replace(/\s+/g, ' ').slice(0, max) : str(input[k], max)
  }
  for (const [k, [lo, hi]] of Object.entries(NODE_NUM)) {
    const n = num(input[k])
    if (input[k] !== undefined && n === undefined) errors.push(`${path}.${k}: not a number`)
    if (n !== undefined) node[k] = Math.max(lo, Math.min(hi, n))
  }
  for (const k of NODE_BOOL) if (input[k] !== undefined) node[k] = bool(input[k])
  for (const [k, [lo, hi]] of Object.entries(NODE_NUMS)) {
    if (input[k] === undefined) continue
    const list = (Array.isArray(input[k]) ? input[k] : [input[k]]).map(num)
    if (list.length < lo || list.length > hi || list.some((x) => x === undefined || x < 0)) errors.push(`${path}.${k}: ${lo}-${hi} numbers`)
    else node[k] = list
  }
  for (const k of NODE_COLOR) node[k] = color(input[k], `${path}.${k}`, errors)
  node.weight = oneOf(input.weight, WEIGHTS, `${path}.weight`, errors)
  node.design = oneOf(input.design, DESIGNS, `${path}.design`, errors)
  node.url = linkUrl(input.url, `${path}.url`, errors)
  if (input.padding !== undefined) {
    const p = (Array.isArray(input.padding) ? input.padding : [input.padding]).map(num)
    if (![1, 2, 4].includes(p.length) || p.some((x) => x === undefined)) errors.push(`${path}.padding: a number or 1, 2 or 4 numbers`)
    else node.padding = p.map((x) => Math.max(0, Math.min(100, x)))
  }
  if (node.src && !ASSET.test(node.src) && !TEMPLATE.test(node.src)) errors.push(`${path}.src: an asset name like logo.png`)
  if (input.children !== undefined) {
    if (!CONTAINERS.has(type)) errors.push(`${path}: ${type} takes no children`)
    else if (!Array.isArray(input.children)) errors.push(`${path}.children must be an array`)
    else node.children = input.children.slice(0, 40).map((c, i) => normalizeNode(c, `${path}.children[${i}]`, errors, state, depth + 1)).filter(Boolean)
  }
  if ((type === 'button' || type === 'check') && !node.action) errors.push(`${path}: ${type} needs an action`)
  if (type === 'link' && !node.url) errors.push(`${path}: link needs a url`)
  return clean(node)
}

// Card layouts are keyed by widget family. Theme layouts may also be keyed "<kind>.<family>" or
// "<card id>.<family>", so one theme can design every card of an app.
export function normalizeLayouts(input, path, errors, { themeKeys = false } = {}) {
  if (input === undefined || input === null) return undefined
  if (typeof input !== 'object' || Array.isArray(input)) { errors.push(`${path} must be an object of family -> node`); return undefined }
  const out = {}
  for (const [key, node] of Object.entries(input)) {
    const family = themeKeys ? key.split('.').pop() : key
    const prefix = themeKeys ? key.slice(0, -family.length - 1) : ''
    if (!FAMILIES.includes(family) || (prefix && !ID.test(prefix))) {
      errors.push(`${path}.${key}: key must be ${themeKeys ? '[<kind or card id>.]' : ''}<${FAMILIES.join('|')}>`)
      continue
    }
    const n = normalizeNode(node, `${path}.${key}`, errors)
    if (n) out[key] = n
  }
  return Object.keys(out).length ? out : undefined
}

function themeColors(input, path, errors) {
  if (!input || typeof input !== 'object') return undefined
  let bg
  if (input.bg !== undefined) {
    const list = (Array.isArray(input.bg) ? input.bg : [input.bg]).slice(0, 4)
    bg = list.map((c, i) => {
      if (HEX.test(String(c))) return String(c)
      errors.push(`${path}.bg[${i}]: background colours are hex only`)
      return undefined
    }).filter(Boolean)
    if (!bg.length) bg = undefined
  }
  const out = { bg }
  for (const k of ['ink', 'muted', 'accent', 'tile']) {
    if (input[k] === undefined) continue
    if (HEX.test(String(input[k]))) out[k] = String(input[k])
    else errors.push(`${path}.${k}: theme colours are hex only`)
  }
  return clean(out)
}

export const DESIGN_ID = /^[a-z][a-z0-9-]{0,31}$/

export function normalizeDesign(input) {
  const errors = []
  if (!input || typeof input !== 'object') return { errors: ['design must be an object'] }
  const id = String(input.id ?? '')
  if (!DESIGN_ID.test(id)) errors.push(`id: "${id}" must match ${DESIGN_ID}`)
  const name = str(input.name, 40)
  if (!name) errors.push('name is required')
  const family = oneOf(input.family, FAMILIES, 'family', errors)
  if (!family) errors.push('family is required')
  const cards = Array.isArray(input.cards) ? input.cards.map(String).filter((c) => c === '*' || ID.test(c)).slice(0, 16) : []
  if (!cards.length) errors.push('cards: at least one card id (or "*")')
  const theme = input.theme === undefined ? undefined : normalizeTheme(input.theme, errors, { layouts: false, path: 'theme' })
  const layout = normalizeNode(input.layout, 'layout', errors, { count: 0, max: MAX_DESIGN_NODES })
  if (!layout) errors.push('layout is required')
  const design = clean({ id, name, n: num(input.n), family, device: oneOf(input.device, ['phone', 'pad', 'any'], 'device', errors),
    cards, theme, layout, note: str(input.note, 200), group: str(input.group, 24) })
  return { design, errors }
}

export function normalizeTheme(input, errors, { layouts = true, path = 'theme' } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) { errors.push(`${path} must be an object`); return undefined }
  const theme = {
    ...themeColors(input, path, errors),
    font: oneOf(input.font, DESIGNS.filter((d) => d !== 'numbers'), `${path}.font`, errors),
    numbers: oneOf(input.numbers, DESIGNS.filter((d) => d !== 'numbers'), `${path}.numbers`, errors),
    family: str(input.family, 48),
    weight: oneOf(input.weight, WEIGHTS, `${path}.weight`, errors),
    image: input.image === undefined ? undefined : ASSET.test(String(input.image)) ? String(input.image) : (errors.push(`${path}.image: an asset name like bg.png`), undefined),
    dark: themeColors(input.dark, `${path}.dark`, errors),
    layouts: layouts ? normalizeLayouts(input.layouts, `${path}.layouts`, errors, { themeKeys: true }) : undefined,
    by: str(input.by, 40),
    note: str(input.note, 200),
  }
  if (theme.dark && !Object.keys(theme.dark).length) delete theme.dark
  return clean(theme)
}

// What the hub does when an action fires. Only ever written from this PC (CLI or a feed),
// never over HTTP, because a handler is code the PC will run.
function normalizeHandlers(input, errors) {
  if (input === undefined || input === null) return undefined
  if (typeof input !== 'object' || Array.isArray(input)) { errors.push('do must be an object of name -> handler'); return undefined }
  const out = {}
  for (const [name, h] of Object.entries(input)) {
    const path = `do.${name}`
    if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(name)) { errors.push(`${path}: bad handler name`); continue }
    if (!h || typeof h !== 'object') { errors.push(`${path} must be an object`); continue }
    const handler = { confirm: bool(h.confirm), then: oneOf(h.then, ['toggle', 'remove', 'none'], `${path}.then`, errors) }
    if (h.http) {
      const method = String(h.http.method ?? 'POST').toUpperCase()
      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) errors.push(`${path}.http.method: ${method}`)
      if (!/^https?:\/\//.test(String(h.http.url ?? ''))) errors.push(`${path}.http.url must be http(s)`)
      handler.http = clean({ method, url: String(h.http.url ?? ''), headers: h.http.headers && typeof h.http.headers === 'object' ? h.http.headers : undefined, body: h.http.body })
    } else if (Array.isArray(h.run) && h.run.length && h.run.every((a) => typeof a === 'string')) {
      handler.run = h.run.slice(0, 32)
      handler.cwd = str(h.cwd, 300)
    } else {
      errors.push(`${path}: needs http {method, url, body} or run [command, ...args]`)
      continue
    }
    out[name] = clean(handler)
  }
  return Object.keys(out).length ? out : undefined
}

function normalizeActions(input, errors) {
  if (input === undefined || input === null) return undefined
  if (!Array.isArray(input)) { errors.push('actions must be an array'); return undefined }
  const out = []
  for (const [i, a] of input.slice(0, 4).entries()) {
    const path = `actions[${i}]`
    if (!a || typeof a !== 'object') { errors.push(`${path} must be an object`); continue }
    const id = String(a.id ?? '')
    if (!ACTION_REF.test(id)) { errors.push(`${path}.id: "${id}" must match ${ACTION_REF}`); continue }
    const label = str(a.label, 18)
    if (!label) { errors.push(`${path}.label is required`); continue }
    out.push(clean({
      id, label, symbol: str(a.symbol, 48),
      style: oneOf(a.style, ['filled', 'plain', 'destructive'], `${path}.style`, errors),
      confirm: bool(a.confirm), on: bool(a.on), url: linkUrl(a.url, `${path}.url`, errors),
    }))
  }
  return out.length ? out : undefined
}

function normalizeData(input, errors) {
  if (input === undefined || input === null) return undefined
  if (typeof input !== 'object' || Array.isArray(input)) { errors.push('data must be an object of key -> text or number'); return undefined }
  const out = {}
  for (const [k, v] of Object.entries(input).slice(0, 24)) {
    if (!/^[A-Za-z0-9_]{1,24}$/.test(k)) { errors.push(`data.${k}: keys are letters, digits, _`); continue }
    if (v === null || v === undefined) continue
    if (typeof v === 'object') { errors.push(`data.${k}: text or number only`); continue }
    out[k] = String(v).slice(0, 120)
  }
  return Object.keys(out).length ? out : undefined
}

// Every field is optional except id and title. Unknown fields are dropped so a
// typo in a session never reaches the phone as garbage.
export function normalizeCard(input, { allowHandlers = true } = {}) {
  const errors = []
  if (!input || typeof input !== 'object') return { errors: ['card must be an object'] }
  const id = String(input.id ?? '').toLowerCase()
  if (!ID.test(id)) errors.push(`id "${input.id}" must match ${ID}`)
  const title = str(input.title, 32)
  if (!title) errors.push('title is required')

  const kind = input.kind ?? (input.items?.length ? 'list' : input.progress !== undefined ? 'gauge' : 'metric')
  if (!KINDS.includes(kind)) errors.push(`kind must be one of ${KINDS.join(', ')}`)
  const tint = input.tint ?? 'accent'
  if (!TINTS.includes(tint)) errors.push(`tint must be one of ${TINTS.join(', ')}`)

  let progress = num(input.progress)
  if (progress !== undefined) progress = Math.max(0, Math.min(1, progress))

  let series
  if (input.series !== undefined) {
    const raw = Array.isArray(input.series) ? input.series : String(input.series).split(',')
    series = raw.map(Number).filter(Number.isFinite).slice(-48)
    if (!series.length) series = undefined
  }

  let items
  if (input.items !== undefined) {
    if (!Array.isArray(input.items)) errors.push('items must be an array')
    else {
      items = input.items.slice(0, 8).map((it, i) => {
        const t = it?.tint && TINTS.includes(it.tint) ? it.tint : undefined
        const action = it?.action === undefined || it?.action === null ? undefined : String(it.action)
        if (action !== undefined && !ACTION_REF.test(action)) errors.push(`items[${i}].action: "${action}" must match ${ACTION_REF}`)
        return clean({ title: str(it?.title, 60) ?? '', detail: str(it?.detail, 60), tag: str(it?.tag, 12), tint: t,
          action, on: bool(it?.on), symbol: str(it?.symbol, 48),
          image: it?.image !== undefined && ASSET.test(String(it.image)) ? String(it.image) : undefined,
          url: linkUrl(it?.url, `items[${i}].url`, errors), value: str(it?.value, 16) })
      }).filter((it) => it.title)
    }
  }

  const url = linkUrl(input.url, 'url', errors)
  const staleAfter = num(input.staleAfter)
  const refresh = refreshOf(input.refresh, errors)
  const order = num(input.order)

  let theme
  if (typeof input.theme === 'string') {
    theme = slug(input.theme)
    if (!theme) errors.push('theme: a theme name or an object')
  } else if (input.theme !== undefined && input.theme !== null) {
    theme = normalizeTheme(input.theme, errors, { layouts: false })
  }
  const layouts = normalizeLayouts(input.layouts, 'layouts', errors)
  const actions = normalizeActions(input.actions, errors)
  const handlers = allowHandlers ? normalizeHandlers(input.do, errors) : undefined
  const open = oneOf(input.open, ['app', 'safari'], 'open', errors)

  if (errors.length) return { errors }
  const card = {
    id, title, kind, tint,
    app: str(input.app, 24),
    symbol: str(input.symbol, 48),
    value: str(input.value, 12),
    label: str(input.label, 24),
    caption: str(input.caption, 80),
    progress, series, items, url, open,
    data: normalizeData(input.data, errors),
    theme, layouts, actions,
    do: handlers,
    staleAfter: staleAfter !== undefined ? Math.max(60, staleAfter) : undefined,
    refresh,
    order,
    source: str(input.source, 40) ?? 'push',
    updatedAt: input.updatedAt && !Number.isNaN(Date.parse(input.updatedAt)) ? new Date(input.updatedAt).toISOString() : new Date().toISOString(),
  }
  if (errors.length) return { errors }
  return { card: clean(card) }
}

function writeAtomic(file, value) {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tmp, JSON.stringify(value, null, 2))
  renameSync(tmp, file)
}

export const MAX_CARDS = 150
export const MAX_CARD_BYTES = 32 * 1024
const refuse = (status, msg) => Object.assign(new Error(msg), { status })

// allowHandlers false is the HTTP path: the caller cannot set `do` or `source`, and cannot touch a
// card that has handlers or belongs to a feed. Rewriting such a card's actions over the wire would
// let a token holder re-aim a handler or skip its confirm.
export function putCard(input, { allowHandlers = true } = {}) {
  const { card, errors } = normalizeCard(input, { allowHandlers })
  if (errors) throw refuse(400, errors.join('; '))
  const prev = getCard(card.id)
  if (!allowHandlers) {
    if (prev?.do) throw refuse(409, `${card.id} has handlers; change it with widget.mjs on the PC`)
    if (prev?.source?.startsWith('feed:')) throw refuse(409, `${card.id} belongs to ${prev.source}`)
    card.source = 'push'
  }
  if (JSON.stringify(card).length > MAX_CARD_BYTES) throw refuse(413, `card over ${MAX_CARD_BYTES / 1024} KB`)
  if (!prev && existsSync(CARDS()) && readdirSync(CARDS()).filter((f) => f.endsWith('.json')).length >= MAX_CARDS) {
    throw refuse(507, `hub holds ${MAX_CARDS} cards; remove some first`)
  }
  writeAtomic(join(CARDS(), `${card.id}.json`), card)
  return card
}

export function getCard(id) {
  if (!ID.test(String(id))) return null
  const file = join(CARDS(), `${id}.json`)
  if (!existsSync(file)) return null
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null }
}

export function listCards() {
  if (!existsSync(CARDS())) return []
  const out = []
  for (const f of readdirSync(CARDS())) {
    if (!f.endsWith('.json')) continue
    try { out.push(JSON.parse(readFileSync(join(CARDS(), f), 'utf8'))) } catch { /* half-written by an old writer, skip */ }
  }
  return out.sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.id.localeCompare(b.id))
}

export function removeCard(id) {
  if (!ID.test(String(id))) return false
  const file = join(CARDS(), `${id}.json`)
  if (!existsSync(file)) return false
  rmSync(file)
  return true
}

// ---------- themes ----------

export function putTheme(name, input) {
  const n = slug(name)
  if (!n) throw Object.assign(new Error('theme name is required'), { status: 400 })
  const errors = []
  const theme = normalizeTheme(input, errors)
  if (errors.length) throw Object.assign(new Error(errors.join('; ')), { status: 400 })
  writeAtomic(join(THEMES_DIR, `${n}.json`), { ...theme, updatedAt: new Date().toISOString() })
  return { name: n, ...theme }
}

export function getTheme(name) {
  const n = slug(name)
  const file = join(THEMES_DIR, `${n}.json`)
  if (!n || !existsSync(file)) return null
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null }
}

export function listThemes() {
  if (!existsSync(THEMES_DIR)) return []
  return readdirSync(THEMES_DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort()
}

export function removeTheme(name) {
  const file = join(THEMES_DIR, `${slug(name)}.json`)
  if (!existsSync(file)) return false
  rmSync(file)
  return true
}

// The theme a card wears: its own named theme, else the one named after its app; an inline theme
// object overrides single fields. Layouts resolve per family: card, then theme keyed by card id,
// then by kind, then the theme's plain family layout.
export function resolveDesign(card) {
  const named = typeof card.theme === 'string' ? card.theme : slug(card.app)
  const base = (named && getTheme(named)) || {}
  const inline = card.theme && typeof card.theme === 'object' ? card.theme : {}
  const { layouts: themeLayouts = {}, updatedAt, by, note, ...baseTheme } = base
  const theme = clean({ ...baseTheme, ...inline, dark: base.dark || inline.dark ? { ...base.dark, ...inline.dark } : undefined })
  const layouts = {}
  for (const f of FAMILIES) {
    const pick = card.layouts?.[f] ?? themeLayouts[`${card.id}.${f}`] ?? themeLayouts[`${card.kind}.${f}`] ?? themeLayouts[f]
    if (pick) layouts[f] = pick
  }
  return { theme: Object.keys(theme).length ? theme : undefined, layouts: Object.keys(layouts).length ? layouts : undefined }
}

// A card that has outlived its staleAfter is still served, flagged, so the
// widget can grey it instead of showing a confident old number.
export function withStaleness(card, now = Date.now()) {
  const age = Math.max(0, Math.round((now - Date.parse(card.updatedAt)) / 1000))
  return { ...card, ageSec: age, stale: card.staleAfter ? age > card.staleAfter : false }
}

// Marks every button and row whose action needs a second tap. The phone guards exactly what it is
// told to, so whatever decides confirm on the PC (a handler, a feed) has to be copied onto the card.
export function markConfirm(card, needs) {
  const name = (ref) => String(ref ?? '').split(':')[0]
  return {
    ...card,
    actions: card.actions?.map((a) => (!a.url && needs(name(a.id)) ? { ...a, confirm: true } : a)),
    items: card.items?.map((it) => (it.action && needs(name(it.action)) ? { ...it, confirm: true } : it)),
  }
}

// What the phone receives: design resolved, handlers stripped, confirm made explicit.
export function servedCard(card, now = Date.now()) {
  const { do: handlers, ...rest } = withStaleness(card, now)
  const { theme, layouts } = resolveDesign(card)
  const confirmed = (n) => !!handlers?.[n]?.confirm || !!card.actions?.some((a) => a.confirm && String(a.id).split(':')[0] === n)
  return clean(markConfirm({ ...rest, theme, layouts }, confirmed))
}

export function assetPath(name) {
  if (!ASSET.test(String(name))) return null
  const file = join(ASSETS_DIR, name)
  return existsSync(file) ? file : null
}
