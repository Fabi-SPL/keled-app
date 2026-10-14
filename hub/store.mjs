// Card store for the Keled widgets. One JSON file per card, written atomically,
// so the CLI, the feeds and the HTTP server can all write without a lock.

import { mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const DATA_DIR = process.env.KELED_WIDGETS_DATA || join(HERE, 'data')
const CARDS = () => join(DATA_DIR, 'cards')

export const KINDS = ['metric', 'list', 'gauge', 'status', 'spark']
export const TINTS = ['accent', 'ok', 'warn', 'bad', 'neutral']
const ID = /^[a-z0-9][a-z0-9-]{0,47}$/

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

// Every field is optional except id and title. Unknown fields are dropped so a
// typo in a session never reaches the phone as garbage.
export function normalizeCard(input) {
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
      items = input.items.slice(0, 8).map((it) => {
        const t = it?.tint && TINTS.includes(it.tint) ? it.tint : undefined
        return { title: str(it?.title, 60) ?? '', detail: str(it?.detail, 60), tag: str(it?.tag, 12), tint: t }
      }).filter((it) => it.title)
    }
  }

  const url = str(input.url, 500)
  if (url && !/^(https?|keled):\/\//.test(url)) errors.push('url must start with https://, http:// or keled://')

  const staleAfter = num(input.staleAfter)
  const order = num(input.order)

  if (errors.length) return { errors }
  const card = {
    id, title, kind, tint,
    app: str(input.app, 24),
    symbol: str(input.symbol, 48),
    value: str(input.value, 12),
    label: str(input.label, 24),
    caption: str(input.caption, 80),
    progress, series, items, url,
    staleAfter: staleAfter !== undefined ? Math.max(60, staleAfter) : undefined,
    order,
    source: str(input.source, 40) ?? 'push',
    updatedAt: input.updatedAt && !Number.isNaN(Date.parse(input.updatedAt)) ? new Date(input.updatedAt).toISOString() : new Date().toISOString(),
  }
  for (const k of Object.keys(card)) if (card[k] === undefined) delete card[k]
  return { card }
}

export function putCard(input) {
  const { card, errors } = normalizeCard(input)
  if (errors) throw Object.assign(new Error(errors.join('; ')), { status: 400 })
  mkdirSync(CARDS(), { recursive: true })
  const file = join(CARDS(), `${card.id}.json`)
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tmp, JSON.stringify(card, null, 2))
  renameSync(tmp, file)
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

// A card that has outlived its staleAfter is still served, flagged, so the
// widget can grey it instead of showing a confident old number.
export function withStaleness(card, now = Date.now()) {
  const age = Math.max(0, Math.round((now - Date.parse(card.updatedAt)) / 1000))
  return { ...card, ageSec: age, stale: card.staleAfter ? age > card.staleAfter : false }
}
