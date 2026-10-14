// Widget actions. The phone sends only { card, action, on }; everything that runs is defined on
// this PC, either as a handler in the card's `do` (CLI) or as a feed's act(). Confirm-actions need
// two taps within ARM_MS, and every run is appended to data/actions.log.

import { execFile } from 'node:child_process'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { ACTION_REF, DATA_DIR, putCard, markConfirm } from './store.mjs'

const execFileP = promisify(execFile)
export const ARM_MS = 10_000
export const FLASH_OK_MS = 30_000
export const FLASH_FAIL_MS = 120_000

// Args fill URL paths and argv: no dot segments that collapse a path, no leading dash an argv
// would read as an option.
export function parseRef(ref) {
  const m = String(ref ?? '').match(ACTION_REF)
  if (!m) return null
  const arg = m[2] ?? ''
  if (/^.{1,2}$/.test(arg) || arg.startsWith('-')) return null
  return { name: m[1], arg }
}

// Only refs the card itself shows can be fired, so a stolen token cannot call a handler the
// card never offered.
export function declared(card, ref) {
  return (card.actions ?? []).some((a) => a.id === ref && !a.url) || (card.items ?? []).some((it) => it.action === ref)
}

const fill = (s, vars, encode = (x) => x) => String(s).replace(/\{(arg|on|card)\}/g, (_, k) => encode(String(vars[k])))
const fillDeep = (v, vars) => {
  if (typeof v === 'string') return fill(v, vars)
  if (Array.isArray(v)) return v.map((x) => fillDeep(x, vars))
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fillDeep(x, vars)]))
  return v
}

export async function runHandler(handler, vars) {
  if (handler.http) {
    const { method = 'POST', url, headers = {}, body } = handler.http
    const init = { method, headers: { ...headers }, signal: AbortSignal.timeout(15_000) }
    if (body !== undefined && method !== 'GET') {
      init.body = typeof body === 'string' ? fill(body, vars) : JSON.stringify(fillDeep(body, vars))
      if (!Object.keys(init.headers).some((h) => h.toLowerCase() === 'content-type')) init.headers['content-type'] = 'application/json'
    }
    const res = await fetch(fill(url, vars, encodeURIComponent), init)
    const text = await res.text()
    if (!res.ok) throw new Error(`HTTP ${res.status} ${text.replace(/\s+/g, ' ').slice(0, 80)}`)
    let message
    try { message = JSON.parse(text)?.message } catch { /* plain text answer */ }
    return { message }
  }
  if (handler.run) {
    const [cmd, ...args] = handler.run.map((a) => fill(a, vars))
    const { stdout } = await execFileP(cmd, args, { timeout: 30_000, windowsHide: true, cwd: handler.cwd, maxBuffer: 1 << 20 })
    return { message: stdout.trim().split('\n').pop()?.slice(0, 60) || undefined }
  }
  throw new Error('handler has neither http nor run')
}

// A put card has no feed to re-read the truth from, so the hub records the obvious change itself.
export function applyLocal(card, ref, handler, on) {
  const then = handler?.then ?? 'toggle'
  if (then === 'none') return card
  const next = { ...card }
  if (then === 'remove') next.items = (card.items ?? []).filter((it) => it.action !== ref)
  else {
    next.items = card.items?.map((it) => (it.action === ref && it.on !== undefined ? { ...it, on } : it))
    next.actions = card.actions?.map((a) => (a.id === ref && a.on !== undefined ? { ...a, on } : a))
  }
  return putCard(next)
}

function log(entry) {
  try {
    mkdirSync(DATA_DIR, { recursive: true })
    appendFileSync(join(DATA_DIR, 'actions.log'), `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`)
  } catch { /* the log is for reading later, never a reason to fail the tap */ }
}

export function createActions({ feeds = [], runFeed }) {
  const armed = new Map()
  const flash = new Map()

  async function fire({ card, ref, on }) {
    const parsed = parseRef(ref)
    if (!parsed || !declared(card, ref)) return { status: 400, body: { ok: false, error: 'action not declared on this card' } }
    const feed = card.source?.startsWith('feed:') ? feeds.find((f) => f.name === card.source.slice(5)) : null
    const handler = card.do?.[parsed.name]
    if (!handler && !feed?.act) return { status: 400, body: { ok: false, error: 'no handler for this action' } }

    const pub = (card.actions ?? []).find((a) => a.id === ref)
    const item = (card.items ?? []).find((it) => it.action === ref)
    const needsConfirm = !!(handler?.confirm || pub?.confirm || feed?.confirm?.includes?.(parsed.name))
    const key = `${card.id}|${ref}`
    if (needsConfirm) {
      const until = armed.get(key)
      if (!until || until < Date.now()) {
        armed.set(key, Date.now() + ARM_MS)
        log({ card: card.id, action: ref, armed: true })
        return { status: 202, body: { ok: true, armed: true, until: Date.now() + ARM_MS } }
      }
      armed.delete(key)
    }

    const started = Date.now()
    const state = typeof on === 'boolean' ? on : !(item?.on ?? pub?.on ?? false)
    try {
      const result = handler
        ? await runHandler(handler, { arg: parsed.arg, on: state, card: card.id })
        : await feed.act({ card, name: parsed.name, arg: parsed.arg, on: state })
      if (feed && runFeed) await runFeed(feed).catch(() => {})
      else applyLocal(card, ref, handler, state)
      const message = String(result?.message || 'Done').slice(0, 60)
      flash.set(card.id, { text: message, tint: 'ok', until: Date.now() + FLASH_OK_MS })
      log({ card: card.id, action: ref, on: state, ok: true, ms: Date.now() - started })
      return { status: 200, body: { ok: true, message } }
    } catch (err) {
      const message = String(err.message || err).slice(0, 200)
      flash.set(card.id, { text: `Failed: ${message}`.slice(0, 60), tint: 'bad', until: Date.now() + FLASH_FAIL_MS })
      log({ card: card.id, action: ref, on: state, ok: false, error: message, ms: Date.now() - started })
      return { status: 502, body: { ok: false, error: message } }
    }
  }

  // Armed buttons and the last result ride along on the served card until they expire.
  function decorate(card, now = Date.now()) {
    const feed = card.source?.startsWith('feed:') ? feeds.find((f) => f.name === card.source.slice(5)) : null
    const out = feed?.confirm?.length ? markConfirm(card, (n) => feed.confirm.includes(n)) : { ...card }
    const arm = {}
    for (const [key, until] of armed) {
      if (until < now) { armed.delete(key); continue }
      const [id, ref] = key.split('|')
      if (id === card.id) arm[ref] = until
    }
    if (Object.keys(arm).length) out.armed = arm
    const f = flash.get(card.id)
    if (f && f.until > now) out.flash = f
    else if (f) flash.delete(card.id)
    return out
  }

  return { fire, decorate }
}
