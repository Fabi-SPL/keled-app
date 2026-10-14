#!/usr/bin/env node
// Keled widget hub. Serves the cards to the iPhone/iPad widgets and runs the
// pull feeds in hub/feeds. Binds 127.0.0.1 only; tailscale serve puts it on
// https://fabi-pc.taildd1460.ts.net:7840 for the tailnet and nothing else.

import { createServer } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { readdirSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { putCard, getCard, listCards, removeCard, servedCard, assetPath, DATA_DIR } from './store.mjs'
import { createActions } from './actions.mjs'
import { loadSecret, PORT } from './config.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const MAX_BODY = 64 * 1024

export function authorized(header, token) {
  if (!token || typeof header !== 'string' || !header.startsWith('Bearer ')) return false
  const a = Buffer.from(header.slice(7))
  const b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}

function send(res, status, body) {
  const json = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(json)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      // Drain the rest unread so the client gets a clean 413 instead of a reset socket.
      if (size > MAX_BODY) { chunks.length = 0; reject(Object.assign(new Error('body too large'), { status: 413 })) }
      else chunks.push(c)
    })
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')) }
      catch { reject(Object.assign(new Error('body is not JSON'), { status: 400 })) }
    })
    req.on('error', reject)
  })
}

export function createHub({ token, feedStatus = () => ({}), feeds = [] }) {
  const actions = createActions({ feeds, runFeed })
  const serve = (card, now = Date.now()) => actions.decorate(servedCard(card, now), now)
  return createServer(async (req, res) => {
    let url
    try { url = new URL(req.url, 'http://hub') } catch { return send(res, 400, { error: 'bad url' }) }
    try {
      if (url.pathname === '/healthz') return send(res, 200, { ok: true })
      if (!authorized(req.headers.authorization, token)) return send(res, 401, { error: 'unauthorized' })

      if (url.pathname === '/v1/cards' && req.method === 'GET') {
        const now = Date.now()
        return send(res, 200, { now: new Date(now).toISOString(), cards: listCards().map((c) => serve(c, now)) })
      }
      if (url.pathname === '/v1/status' && req.method === 'GET') {
        return send(res, 200, { cards: listCards().length, feeds: feedStatus() })
      }
      if (url.pathname === '/v1/actions' && req.method === 'POST') {
        const body = await readBody(req)
        const card = getCard(String(body.card ?? ''))
        if (!card) return send(res, 404, { ok: false, error: 'no such card' })
        const out = await actions.fire({ card, ref: String(body.action ?? ''), on: body.on })
        return send(res, out.status, out.body)
      }
      const asset = url.pathname.match(/^\/v1\/assets\/([a-z0-9.-]+)$/)
      if (asset && req.method === 'GET') {
        const file = assetPath(asset[1])
        if (!file) return send(res, 404, { error: 'no such asset' })
        res.writeHead(200, { 'content-type': file.endsWith('.png') ? 'image/png' : 'image/jpeg', 'cache-control': 'private, max-age=3600' })
        return res.end(readFileSync(file))
      }
      const m = url.pathname.match(/^\/v1\/cards\/([a-z0-9-]+)$/)
      if (m) {
        if (req.method === 'GET') {
          const card = getCard(m[1])
          return card ? send(res, 200, serve(card)) : send(res, 404, { error: 'no such card' })
        }
        if (req.method === 'PUT' || req.method === 'POST') {
          const body = await readBody(req)
          // Over HTTP a card can never carry handlers: those are code this PC runs.
          return send(res, 200, servedCard(putCard({ ...body, id: m[1] }, { allowHandlers: false })))
        }
        if (req.method === 'DELETE') return send(res, removeCard(m[1]) ? 200 : 404, { id: m[1] })
      }
      return send(res, 404, { error: 'not found' })
    } catch (err) {
      return send(res, err.status || 500, { error: err.message })
    }
  })
}

// Feeds: hub/feeds/<name>.mjs, default export { every: seconds, run(): card | card[], act?, confirm? }.
// act({ card, name, arg, on }) runs a widget action on one of the feed's cards; confirm lists the
// action names that need a second tap.
// A feed that throws keeps its last good cards and is reported in /v1/status.
export async function loadFeeds(dir = join(HERE, 'feeds')) {
  const feeds = []
  let files = []
  try { files = readdirSync(dir).filter((f) => f.endsWith('.mjs') && !f.startsWith('_')) } catch { return feeds }
  for (const f of files) {
    const mod = await import(pathToFileURL(join(dir, f)).href)
    const feed = mod.default
    if (feed?.run) feeds.push({ name: f.replace(/\.mjs$/, ''), every: Math.max(30, feed.every ?? 300), run: feed.run, act: feed.act, confirm: feed.confirm })
  }
  return feeds
}

export async function runFeed(feed) {
  const out = await feed.run()
  const cards = (Array.isArray(out) ? out : [out]).filter(Boolean)
  return cards.map((c) => putCard({ ...c, source: `feed:${feed.name}` }))
}

async function main() {
  const secret = loadSecret()
  if (!secret?.token) {
    console.error('No token. Run: node hub/widget.mjs init')
    process.exit(2)
  }
  const status = {}
  const feeds = await loadFeeds()
  const tick = async (feed) => {
    const started = Date.now()
    try {
      const cards = await runFeed(feed)
      status[feed.name] = { ok: true, cards: cards.map((c) => c.id), at: new Date().toISOString(), ms: Date.now() - started }
    } catch (err) {
      status[feed.name] = { ok: false, error: String(err.message || err).slice(0, 300), at: new Date().toISOString() }
      console.error(`[feed ${feed.name}]`, err.message || err)
    }
    try {
      mkdirSync(DATA_DIR, { recursive: true })
      writeFileSync(join(DATA_DIR, 'feeds.json'), JSON.stringify(status, null, 2))
    } catch { /* status file is a convenience */ }
  }
  for (const feed of feeds) {
    tick(feed)
    setInterval(() => tick(feed), feed.every * 1000).unref()
  }
  const server = createHub({ token: secret.token, feedStatus: () => status, feeds })
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`keled widget hub on http://127.0.0.1:${PORT} · feeds: ${feeds.map((f) => `${f.name}/${f.every}s`).join(', ') || 'none'}`)
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main()
