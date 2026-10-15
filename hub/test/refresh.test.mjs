import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'keled-refresh-'))
process.env.KELED_WIDGETS_DATA = dir
process.env.KELED_WIDGETS_THEMES = join(dir, 'themes')
process.env.KELED_WIDGETS_ASSETS = join(dir, 'assets')
const store = await import('../store.mjs')
const { createHub, runFeed } = await import('../server.mjs')
const { logFetch, reloadStats } = await import('../reloads.mjs')

let server, base
const TOKEN = 'refresh-token'
before(async () => {
  server = createHub({ token: TOKEN })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => { server.close(); rmSync(dir, { recursive: true, force: true }) })

const card = (refresh) => store.normalizeCard({ id: 'n', title: 'N', refresh })

test('refresh takes seconds or 5m/1h and clamps to what iOS honours', () => {
  assert.equal(card(undefined).card.refresh, undefined)
  assert.equal(card('5m').card.refresh, 300)
  assert.equal(card('30m').card.refresh, 1800)
  assert.equal(card('1h').card.refresh, 3600)
  assert.equal(card(900).card.refresh, 900)
  assert.equal(card(60).card.refresh, 300, 'under 5 minutes is raised to the floor')
  assert.equal(card('2m').card.refresh, 300)
  assert.equal(card('48h').card.refresh, 86400)
  assert.match(card('fast').errors[0], /refresh/)
})

test('a feed pace applies to its cards, a card pace wins', async () => {
  const [a] = await runFeed({ name: 'slow', refresh: '30m', run: async () => ({ id: 'bank', title: 'Bank' }) })
  assert.equal(a.refresh, 1800)
  const [b] = await runFeed({ name: 'mixed', refresh: '30m', run: async () => ({ id: 'nn', title: 'NN', refresh: '5m' }) })
  assert.equal(b.refresh, 300)
  const served = await (await fetch(`${base}/v1/cards`, { headers: { authorization: `Bearer ${TOKEN}`, 'x-keled-source': 'widget:nn' } })).json()
  assert.equal(served.cards.find((c) => c.id === 'nn').refresh, 300)
})

test('every phone fetch is logged by source and summarised', async () => {
  const t0 = Date.now() - 3600_000
  for (let i = 0; i < 5; i++) logFetch('widget:neural', t0 + i * 6 * 60_000)
  logFetch('bad source with spaces', t0)
  const rows = reloadStats(24)
  const nn = rows.find((r) => r.src === 'widget:neural')
  assert.equal(nn.count, 5)
  assert.equal(nn.medianMin, 6)
  assert.ok(rows.find((r) => r.src === 'unknown'), 'garbage source is bucketed, never stored raw')
  assert.ok(rows.find((r) => r.src === 'widget:nn'), 'the HTTP route logs the header')
  const unauth = await fetch(`${base}/v1/cards`, { headers: { 'x-keled-source': 'intruder' } })
  assert.equal(unauth.status, 401)
  assert.equal(reloadStats(24).find((r) => r.src === 'intruder'), undefined, 'unauthorised calls are not logged')
})
