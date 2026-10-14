#!/usr/bin/env node
// The one command any session uses to put something on Fabi's iPhone/iPad widgets.
// Writes straight into the card store, so it works whether or not the hub is running.
//
//   node C:/Programs/Claude/keled-app/hub/widget.mjs put mail --title Mail --value 12 --label unread \
//        --app "Keled Mail" --symbol envelope.fill --tint warn --url https://... --stale 3600
//   node .../widget.mjs put deploys --title Deploys --kind list \
//        --item "api|green 4m ago|ok|ok" --item "site|failed|!|bad"
//   node .../widget.mjs put build --json '{"title":"Build","progress":0.6,"value":"60%"}'
//   node .../widget.mjs list | get <id> | rm <id> | feed <name> | doctor | init | schema

import { putCard, getCard, listCards, removeCard, withStaleness, KINDS, TINTS } from './store.mjs'
import { loadSecret, SECRET_FILE, PORT, PUBLIC_URL } from './config.mjs'
import { loadFeeds, runFeed } from './server.mjs'
import { readFileSync } from 'node:fs'

const [cmd, ...rest] = process.argv.slice(2)

function parseFlags(args) {
  const flags = { item: [] }
  const pos = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (!a.startsWith('--')) { pos.push(a); continue }
    const key = a.slice(2)
    const val = args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[++i] : 'true'
    if (key === 'item') flags.item.push(val)
    else flags[key] = val
  }
  return { flags, pos }
}

function cardFromFlags(id, f) {
  let base = {}
  if (f.json) base = JSON.parse(f.json)
  if (f.file) base = JSON.parse(readFileSync(f.file, 'utf8'))
  const card = { ...base, id }
  for (const k of ['title', 'app', 'symbol', 'tint', 'kind', 'value', 'label', 'caption', 'url', 'progress', 'series', 'order']) {
    if (f[k] !== undefined) card[k] = f[k]
  }
  if (f.stale !== undefined) card.staleAfter = f.stale
  if (f.item.length) {
    card.items = f.item.map((s) => {
      const [title, detail, tag, tint] = s.split('|')
      return { title, detail: detail || undefined, tag: tag || undefined, tint: tint || undefined }
    })
  }
  return card
}

const SCHEMA = `Card fields (all optional except id + title):
  id        a-z 0-9 -, max 48       title    max 32 chars
  app       group name ("Keled Mail") symbol  SF Symbol name (envelope.fill)
  kind      ${KINDS.join(' | ')}  (default: list if items, gauge if progress, else metric)
  tint      ${TINTS.join(' | ')}
  value     the big number/word, max 12   label  unit under it, max 24
  caption   one line, max 80        url      tap target, https:// or keled://
  progress  0..1 (gauge ring)       series   comma numbers (sparkline), max 48
  items     up to 8 x {title, detail, tag, tint}   (--item "title|detail|tag|tint")
  staleAfter seconds; older cards render greyed with their age
  order     sort key, lower first (default 100)`

async function doctor() {
  const secret = loadSecret()
  console.log(`token file   ${secret?.token ? 'ok' : 'MISSING (run init)'}  ${SECRET_FILE}`)
  console.log(`cards        ${listCards().length}`)
  for (const [label, base] of [['local', `http://127.0.0.1:${PORT}`], ['tailnet', PUBLIC_URL]]) {
    try {
      const r = await fetch(`${base}/v1/status`, { headers: { authorization: `Bearer ${secret?.token}` }, signal: AbortSignal.timeout(5000) })
      const body = await r.json()
      console.log(`${label.padEnd(12)} HTTP ${r.status}  ${base}`)
      if (label === 'local' && body.feeds) {
        for (const [name, s] of Object.entries(body.feeds)) console.log(`  feed ${name.padEnd(10)} ${s.ok ? 'ok' : 'FAIL ' + s.error}  ${s.at}`)
      }
    } catch (err) {
      console.log(`${label.padEnd(12)} DOWN  ${base}  (${err.cause?.code || err.message})`)
    }
  }
}

const { flags, pos } = parseFlags(rest)
try {
  switch (cmd) {
    case 'put': {
      if (!pos[0]) throw new Error('usage: put <id> --title ... (see: schema)')
      const card = putCard(cardFromFlags(pos[0], flags))
      console.log(JSON.stringify(card, null, 2))
      break
    }
    case 'get': {
      const c = getCard(pos[0])
      if (!c) { console.error(`no card ${pos[0]}`); process.exit(1) }
      console.log(JSON.stringify(withStaleness(c), null, 2))
      break
    }
    case 'list':
      for (const c of listCards().map((x) => withStaleness(x))) {
        console.log(`${c.id.padEnd(22)} ${(c.app ?? '').padEnd(14)} ${c.kind.padEnd(7)} ${String(c.value ?? c.items?.length ?? '').padEnd(8)} ${c.stale ? 'STALE ' : ''}${c.ageSec}s  ${c.source}`)
      }
      break
    case 'rm':
      console.log(removeCard(pos[0]) ? `removed ${pos[0]}` : `no card ${pos[0]}`)
      break
    case 'feed': {
      const feeds = await loadFeeds()
      const feed = feeds.find((f) => f.name === pos[0])
      if (!feed) throw new Error(`no feed ${pos[0]}; have: ${feeds.map((f) => f.name).join(', ')}`)
      for (const c of await runFeed(feed)) console.log(JSON.stringify(c))
      break
    }
    case 'init': {
      const s = loadSecret({ create: true })
      console.log(`token ready in ${SECRET_FILE} (${s.token.length} chars)`)
      break
    }
    case 'doctor': await doctor(); break
    case 'schema': console.log(SCHEMA); break
    default:
      console.log('usage: widget.mjs put|get|list|rm|feed|doctor|init|schema   (schema prints every field)')
      process.exit(cmd ? 1 : 0)
  }
} catch (err) {
  // exitCode, not exit(): exiting with a fetch still closing trips a libuv assert on Windows.
  console.error(err.message)
  process.exitCode = 1
}
