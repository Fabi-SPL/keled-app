#!/usr/bin/env node
// The one command any session uses to put something on Fabi's iPhone/iPad widgets.
// Writes straight into the card store, so it works whether or not the hub is running.
//
//   node C:/Programs/Claude/keled-app/hub/widget.mjs put mail --title Mail --value 12 --label unread \
//        --app "Keled Mail" --symbol envelope.fill --tint warn --url https://... --stale 3600
//   node .../widget.mjs put deploys --title Deploys --kind list \
//        --item "api|green 4m ago|ok|ok" --item "site|failed|!|bad"
//   node .../widget.mjs put build --json '{"title":"Build","progress":0.6,"value":"60%"}'
//   node .../widget.mjs theme put keled-mail --file theme.json     (design for every card of an app)
//   node .../widget.mjs act tv-alerts ack:3fa2c1                    (fire a button like the phone does)
//   node .../widget.mjs preview mail taxes                          (simulator screenshots, ~8 min)
//   node .../widget.mjs list | get <id> | rm <id> | feed <name> | doctor | init | schema

import {
  putCard, getCard, listCards, removeCard, withStaleness, servedCard, normalizeCard,
  putTheme, getTheme, listThemes, removeTheme, ASSETS_DIR, ASSET, KINDS, TINTS, FAMILIES, NODE_TYPES,
} from './store.mjs'
import { loadSecret, SECRET_FILE, PORT, PUBLIC_URL } from './config.mjs'
import { loadFeeds, runFeed } from './server.mjs'
import { readFileSync, writeFileSync, rmSync, copyFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs'
import { seal, open } from './seal.mjs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'

const REPO = 'Fabi-SPL/keled-app'
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [cmd, ...rest] = process.argv.slice(2)
const MULTI = ['item', 'layout', 'data', 'action', 'do']

function parseFlags(args) {
  const flags = Object.fromEntries(MULTI.map((k) => [k, []]))
  const pos = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (!a.startsWith('--')) { pos.push(a); continue }
    const key = a.slice(2)
    const val = args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[++i] : 'true'
    if (MULTI.includes(key)) flags[key].push(val)
    else flags[key] = val
  }
  return { flags, pos }
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
const splitOnce = (s, sep) => {
  const i = s.indexOf(sep)
  if (i < 0) throw new Error(`expected name${sep}value, got "${s}"`)
  return [s.slice(0, i), s.slice(i + 1)]
}

function cardFromFlags(id, f) {
  let base = {}
  if (f.json) base = JSON.parse(f.json)
  if (f.file) base = readJson(f.file)
  const card = { ...base, id }
  for (const k of ['title', 'app', 'symbol', 'tint', 'kind', 'value', 'label', 'caption', 'url', 'open', 'progress', 'series', 'order', 'theme']) {
    if (f[k] !== undefined) card[k] = f[k]
  }
  if (f.stale !== undefined) card.staleAfter = f.stale
  if (f.item.length) {
    card.items = f.item.map((s) => {
      const [title, detail, tag, tint, action, on] = s.split('|')
      return {
        title, detail: detail || undefined, tag: tag || undefined, tint: tint || undefined,
        action: action || undefined, on: on === undefined || on === '' ? undefined : on === 'true' || on === 'on',
      }
    })
  }
  if (f.action.length) {
    card.actions = f.action.map((s) => {
      const [aid, label, symbol, style, confirm] = s.split('|')
      const out = { id: aid, label: label || aid, symbol: symbol || undefined, style: style || undefined }
      if (confirm === 'confirm' || confirm === 'true') out.confirm = true
      if (/^https?:|^keled:/.test(confirm ?? '')) out.url = confirm
      return out
    })
  }
  if (f.layout.length) {
    card.layouts = { ...card.layouts }
    for (const s of f.layout) {
      const [family, file] = splitOnce(s, '=')
      card.layouts[family] = readJson(file)
    }
  }
  if (f.data.length) {
    card.data = { ...card.data }
    for (const s of f.data) {
      const [k, v] = splitOnce(s, '=')
      card.data[k] = v
    }
  }
  if (f.do.length) {
    card.do = { ...card.do }
    for (const s of f.do) {
      const [name, json] = splitOnce(s, '=')
      card.do[name] = JSON.parse(json)
    }
  }
  return card
}

const SCHEMA = `Card fields (all optional except id + title):
  id        a-z 0-9 -, max 48       title    max 32 chars
  app       group name ("Keled Mail"); also picks the theme named after it (keled-mail)
  symbol    SF Symbol name (envelope.fill)
  kind      ${KINDS.join(' | ')}  (default: list if items, gauge if progress, else metric)
  tint      ${TINTS.join(' | ')}   (status colour; accent = the theme's accent)
  value     the big number/word, max 12   label  unit under it, max 24
  caption   one line, max 80
  url       tap target: https:// opens the web app INSIDE Keled; keled:// or other schemes pass through
  open      app (default) | safari     where an https url opens
  progress  0..1 (gauge ring)       series   comma numbers (sparkline), max 48
  items     up to 8 x {title, detail, tag, tint, action, on, symbol}
            --item "title|detail|tag|tint|action|on"   (on = true|false draws a tick box)
  data      free strings for layouts, max 24 keys     --data due=2027-01-11
  theme     theme name, or an inline theme object (overrides single fields of the app's theme)
  layouts   per widget size: { ${FAMILIES.join(', ')} } -> node tree    --layout small=file.json
  actions   up to 4 buttons {id, label, symbol, style filled|plain|destructive, confirm, on, url}
            --action "id|label|symbol|style|confirm"   (5th field "confirm" or a url to open instead)
  do        CLI ONLY. What an action runs on this PC, by action name (the part before ':'):
            {"http":{"method":"POST","url":"http://127.0.0.1:7480/x/{arg}","body":{"on":"{on}"}}}
            {"run":["node","script.mjs","{arg}"],"cwd":"C:/..."}   plus "confirm":true,
            "then":"toggle"|"remove"|"none"     --do 'ack={"http":{...}}'
            An action ref is name or name:arg (arg [A-Za-z0-9._~-]{1,80}); {arg} {on} {card} fill in.
  staleAfter seconds; older cards render greyed with their age
  order     sort key, lower first (default 100)

Layout nodes (draw anything, natively): {"type": ..., children: [...]}
  ${NODE_TYPES.join(' ')}
  templates: {title} {value} {label} {caption} {app} {progress} {percent} {age} {count} {flash}
             {data.x} {item.title|detail|tag|tint|action|on|symbol} {items.0.title} {index}
  any node:  padding (n | [v,h] | [t,l,b,r]), width, height, maxW, maxH, frameAlign, bg, stroke,
             strokeWidth, radius, opacity, accent (tinted lock screen), when "{data.x}" (hide if empty/0/false)
  text: text, size, weight, design (system|rounded|serif|mono|numbers), family, color, lines,
        scale, tracking, upper, italic, mono, privacy (hidden when the phone is locked), align
  stacks: spacing, align (leading|center|trailing / top|bottom|baseline)
  symbol: name   image: src (asset), fit fill|fit   ring/bar: value "{progress}", color, track, line
  spark: series (card series, or "data.x" = comma numbers)   rect/circle/divider: color
  date: date (ISO, yyyy-MM-dd, ms), style days|timer|relative|time|date (ticks on the phone)
  each: repeats children per item (limit, style row)   button: action, label, symbol, style filled
  check: tick box for {item.action}   link: url, children (opens the web app inside Keled)
  colours: ink muted accent bg tile tint ok warn bad neutral white black clear, #hex, or {template}; "@0.4" = opacity
  Full examples: CLAUDE.md in ${ROOT.replace(/\\/g, '/')}

Themes (one per app, data on the hub, no build):  theme put <name> --file theme.json
  { ink, muted, accent, tile, bg:[hex...], font: system|rounded|serif|mono, numbers, weight,
    image: asset name, dark: { same colour keys }, layouts: { "<family>" | "<kind>.<family>" | "<cardId>.<family>": node } }
  Lock-screen sizes are drawn by iOS in one tint: themes keep only their fonts there.`

function hubToken() {
  const secret = loadSecret()
  if (!secret?.token) throw new Error(`no token in ${SECRET_FILE} (run init)`)
  return secret.token
}

async function hub(path, init = {}) {
  const r = await fetch(`http://127.0.0.1:${PORT}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${hubToken()}`, 'content-type': 'application/json', ...init.headers },
    signal: AbortSignal.timeout(30_000),
  })
  const body = await r.json().catch(() => ({}))
  return { status: r.status, body }
}

async function doctor() {
  const secret = loadSecret()
  console.log(`token file   ${secret?.token ? 'ok' : 'MISSING (run init)'}  ${SECRET_FILE}`)
  console.log(`cards        ${listCards().length}`)
  console.log(`themes       ${listThemes().join(', ') || 'none'}`)
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

function gh(args, opts = {}) {
  return execFileSync('gh', args, { encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 24, ...opts }).trim()
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Simulator screenshots of cards before they reach the phone. Takes stored card ids, or a JSON
// file of cards that are not stored yet (--file), resolved exactly as the phone would get them.
async function preview(ids, f) {
  let cards
  if (f.file) {
    const raw = readJson(f.file)
    cards = (Array.isArray(raw) ? raw : raw.cards ?? [raw]).map((input) => {
      const { card, errors } = normalizeCard(input)
      if (errors) throw new Error(`${input?.id ?? '?'}: ${errors.join('; ')}`)
      return servedCard(card)
    })
  } else {
    if (!ids.length) throw new Error('usage: preview <id> [id...]   or   preview --file cards.json')
    cards = ids.map((id) => {
      const c = getCard(id)
      if (!c) throw new Error(`no card ${id}`)
      return servedCard(c)
    })
  }
  const payload = seal(gzipSync(JSON.stringify({ cards }))).toString('base64')
  if (payload.length > 60_000) throw new Error(`cards too big to send (${payload.length} chars base64); preview fewer at once`)
  const tag = `${(f.tag || cards[0].id).replace(/[^a-z0-9-]/gi, '').slice(0, 24)}-${Date.now().toString(36)}`
  gh(['workflow', 'run', 'ios-check.yml', '-R', REPO, '-f', `cards=${payload}`, '-f', `tag=${tag}`])
  console.log(`dispatched preview ${tag} with ${cards.length} card(s); finding the run...`)
  let id
  for (let i = 0; i < 30 && !id; i++) {
    await sleep(4000)
    const runs = JSON.parse(gh(['run', 'list', '-R', REPO, '--workflow', 'ios-check.yml', '--limit', '15', '--json', 'databaseId,displayTitle']))
    id = runs.find((r) => r.displayTitle === `iOS preview ${tag}`)?.databaseId
  }
  if (!id) throw new Error(`run for ${tag} not found; check: gh run list -R ${REPO}`)
  console.log(`run ${id}: https://github.com/${REPO}/actions/runs/${id}  (build + shots take ~8 min)`)
  if (f.wait === 'false') return
  // watch can exit non-zero on an API hiccup; the run's own conclusion is the verdict.
  try { gh(['run', 'watch', String(id), '-R', REPO, '--interval', '20'], { stdio: 'ignore' }) } catch { /* checked below */ }
  let failed = false
  for (let i = 0; i < 60; i++) {
    const { status, conclusion } = JSON.parse(gh(['run', 'view', String(id), '-R', REPO, '--json', 'status,conclusion']))
    if (status === 'completed') { failed = conclusion !== 'success'; break }
    await sleep(15000)
  }
  const out = join(ROOT, 'shots', 'preview', tag)
  mkdirSync(out, { recursive: true })
  try { gh(['run', 'download', String(id), '-R', REPO, '-n', 'keled-preview', '-D', out]) } catch { /* listed below */ }
  for (const n of existsSync(out) ? readdirSync(out).filter((n) => n.endsWith('.png.enc')) : []) {
    writeFileSync(join(out, n.slice(0, -4)), open(readFileSync(join(out, n))))
    rmSync(join(out, n))
  }
  const pngs = existsSync(out) ? readdirSync(out).filter((n) => n.startsWith('preview-')).sort() : []
  if (failed) console.log(`run FAILED; build log: gh run download ${id} -R ${REPO} -n build-log`)
  if (!pngs.length) throw new Error('no preview screenshots came back')
  console.log('look at every one of these before calling the design done:')
  for (const n of pngs) console.log(`  ${join(out, n).replace(/\\/g, '/')}`)
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
      console.log(JSON.stringify(flags.served ? servedCard(c) : withStaleness(c), null, 2))
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
    case 'theme': {
      const [sub, name] = pos
      if (sub === 'list') { console.log(listThemes().join('\n') || 'no themes'); break }
      if (!name) throw new Error('usage: theme put|get|rm <name> [--file theme.json | --json {...}]   theme list')
      if (sub === 'put') {
        const input = flags.file ? readJson(flags.file) : JSON.parse(flags.json ?? '{}')
        console.log(JSON.stringify(putTheme(name, input), null, 2))
      } else if (sub === 'get') {
        const t = getTheme(name)
        if (!t) throw new Error(`no theme ${name}`)
        console.log(JSON.stringify(t, null, 2))
      } else if (sub === 'rm') console.log(removeTheme(name) ? `removed theme ${name}` : `no theme ${name}`)
      else throw new Error(`unknown: theme ${sub}`)
      break
    }
    case 'asset': {
      const [sub, file] = pos
      if (sub === 'list') {
        for (const n of existsSync(ASSETS_DIR) ? readdirSync(ASSETS_DIR) : []) console.log(`${n.padEnd(40)} ${statSync(join(ASSETS_DIR, n)).size} B`)
        break
      }
      if (sub !== 'put' || !file) throw new Error('usage: asset put <file.png|jpg> [--name name.png]   asset list')
      const name = (flags.name || basename(file)).toLowerCase()
      if (!ASSET.test(name)) throw new Error(`asset name "${name}" must match ${ASSET}`)
      if (statSync(file).size > 1_000_000) throw new Error('asset over 1 MB; widgets get ~30 MB of memory, keep images small')
      mkdirSync(ASSETS_DIR, { recursive: true })
      copyFileSync(file, join(ASSETS_DIR, name))
      console.log(`asset ${name} ready; use it as "image": "${name}" in a theme or {"type":"image","src":"${name}"}`)
      break
    }
    case 'act': {
      const [id, ref] = pos
      if (!id || !ref) throw new Error('usage: act <card> <action-ref> [--on true|false]   (fires it through the hub, like a tap)')
      const body = { card: id, action: ref }
      if (flags.on !== undefined) body.on = flags.on === 'true'
      const { status, body: out } = await hub('/v1/actions', { method: 'POST', body: JSON.stringify(body) })
      console.log(`HTTP ${status} ${JSON.stringify(out)}`)
      if (status >= 400) process.exitCode = 1
      break
    }
    case 'preview': await preview(pos, flags); break
    case 'feed': {
      const feeds = await loadFeeds()
      const feed = feeds.find((x) => x.name === pos[0])
      if (!feed) throw new Error(`no feed ${pos[0]}; have: ${feeds.map((x) => x.name).join(', ')}`)
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
      console.log('usage: widget.mjs put|get|list|rm|theme|asset|act|preview|feed|doctor|init|schema   (schema prints every field)')
      process.exit(cmd ? 1 : 0)
  }
} catch (err) {
  // exitCode, not exit(): exiting with a fetch still closing trips a libuv assert on Windows.
  console.error(err.message)
  process.exitCode = 1
}
