#!/usr/bin/env node
// Keled widget hub. Serves the cards to the iPhone/iPad widgets and runs the
// pull feeds in hub/feeds. Binds 127.0.0.1 only; tailscale serve puts it on
// https://fabi-pc.taildd1460.ts.net:7840 for the tailnet and nothing else.

import { createServer } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { putCard, getCard, listCards, removeCard, withStaleness, DATA_DIR } from './store.mjs'
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
      if (size > MAX_BODY) { reject(Object.assign(new Error('body too large'), { status: 413 })); req.destroy() }
      else chunks.push(c)
    })
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')) }
      catch { reject(Object.assign(new Error('body is not JSON'), { status: 400 })) }
    })
    req.on('error', reject)
  })
}

export function createHub({ token, feedStatus = () => ({}) }) {
  return createServer(async (req, res) => {
    let url
    try { url = new URL(req.url, 'http://hub') } catch { return send(res, 400, { error: 'bad url' }) }
    try {
      if (url.pathname === '/healthz') return send(res, 200, { ok: true })
      if (!authorized(req.headers.authorization, token)) return send(res, 401, { error: 'unauthorized' })

      if (url.pathname === '/v1/cards' && req.method === 'GET') {
        const now = Date.now()
        return send(res, 200, { now: new Date(now).toISOString(), cards: listCards().map((c) => withStaleness(c, now)) })
      }
      if (url.pathname === '/v1/status' && req.method === 'GET') {
        return send(res, 200, { cards: listCards().length, feeds: feedStatus() })
      }
      const m = url.pathname.match(/^\/v1\/cards\/([a-z0-9-]+)$/)
      if (m) {
        if (req.method === 'GET') {
          const card = getCard(m[1])
          return card ? send(res, 200, withStaleness(card)) : send(res, 404, { error: 'no such card' })
        }
        if (req.method === 'PUT' || req.method === 'POST') {
          const body = await readBody(req)
          return send(res, 200, putCard({ ...body, id: m[1] }))
        }
        if (req.method === 'DELETE') return send(res, removeCard(m[1]) ? 200 : 404, { id: m[1] })
      }
      return send(res, 404, { error: 'not found' })
    } catch (err) {
      return send(res, err.status || 500, { error: err.message })
    }
  })
}

// Feeds: hub/feeds/<name>.mjs, default export { every: seconds, run(): card | card[] }.
// A feed that throws keeps its last good cards and is reported in /v1/status.
export async function loadFeeds(dir = join(HERE, 'feeds')) {
  const feeds = []
  let files = []
  try { files = readdirSync(dir).filter((f) => f.endsWith('.mjs') && !f.startsWith('_')) } catch { return feeds }
  for (const f of files) {
    const mod = await import(pathToFileURL(join(dir, f)).href)
    const feed = mod.default
    if (feed?.run) feeds.push({ name: f.replace(/\.mjs$/, ''), every: Math.max(30, feed.every ?? 300), run: feed.run })
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
  const server = createHub({ token: secret.token, feedStatus: () => status })
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`keled widget hub on http://127.0.0.1:${PORT} · feeds: ${feeds.map((f) => `${f.name}/${f.every}s`).join(', ') || 'none'}`)
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main()
