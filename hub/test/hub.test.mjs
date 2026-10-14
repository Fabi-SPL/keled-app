import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'keled-widgets-'))
process.env.KELED_WIDGETS_DATA = dir
const store = await import('../store.mjs')
const { createHub, authorized, runFeed } = await import('../server.mjs')

let server, base
const TOKEN = 'test-token-123'

before(async () => {
  server = createHub({ token: TOKEN })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => { server.close(); rmSync(dir, { recursive: true, force: true }) })

test('normalizeCard requires id and title and drops unknown fields', () => {
  assert.deepEqual(store.normalizeCard({ id: 'x' }).errors, ['title is required'])
  assert.match(store.normalizeCard({ id: 'Bad Id!', title: 't' }).errors[0], /id/)
  const { card } = store.normalizeCard({ id: 'mail', title: 'Mail', value: 12, junk: 'nope' })
  assert.equal(card.value, '12')
  assert.equal(card.kind, 'metric')
  assert.equal(card.junk, undefined)
})

test('kind is inferred from shape, progress clamped, lengths capped', () => {
  assert.equal(store.normalizeCard({ id: 'a', title: 'A', items: [{ title: 'one' }] }).card.kind, 'list')
  const g = store.normalizeCard({ id: 'b', title: 'B', progress: 7 }).card
  assert.equal(g.kind, 'gauge')
  assert.equal(g.progress, 1)
  assert.equal(store.normalizeCard({ id: 'c', title: 'x'.repeat(99) }).card.title.length, 32)
  assert.equal(store.normalizeCard({ id: 'd', title: 'D', series: '1,2,x,3' }).card.series.length, 3)
})

test('rejects bad tint, kind and url scheme', () => {
  assert.ok(store.normalizeCard({ id: 'a', title: 'A', tint: 'pink' }).errors)
  assert.ok(store.normalizeCard({ id: 'a', title: 'A', kind: 'pie' }).errors)
  assert.ok(store.normalizeCard({ id: 'a', title: 'A', url: 'javascript:alert(1)' }).errors)
})

test('put, list in order, staleness, remove', () => {
  store.putCard({ id: 'zeta', title: 'Z', order: 1 })
  store.putCard({ id: 'alpha', title: 'A', staleAfter: 60, updatedAt: new Date(Date.now() - 120_000).toISOString() })
  assert.deepEqual(store.listCards().map((c) => c.id), ['zeta', 'alpha'])
  assert.equal(store.withStaleness(store.getCard('alpha')).stale, true)
  assert.equal(store.withStaleness(store.getCard('zeta')).stale, false)
  assert.equal(store.removeCard('zeta'), true)
  assert.equal(store.getCard('zeta'), null)
})

test('a half-written card file never breaks the list', () => {
  mkdirSync(join(dir, 'cards'), { recursive: true })
  writeFileSync(join(dir, 'cards', 'broken.json'), '{"id":')
  assert.ok(store.listCards().every((c) => c.id !== 'broken'))
})

test('authorized needs the exact bearer token', () => {
  assert.equal(authorized(`Bearer ${TOKEN}`, TOKEN), true)
  assert.equal(authorized(`Bearer ${TOKEN}x`, TOKEN), false)
  assert.equal(authorized(undefined, TOKEN), false)
  assert.equal(authorized('Bearer ', ''), false)
})

test('HTTP: healthz open, everything else needs the token', async () => {
  assert.equal((await fetch(`${base}/healthz`)).status, 200)
  assert.equal((await fetch(`${base}/v1/cards`)).status, 401)
  assert.equal((await fetch(`${base}/v1/cards`, { headers: { authorization: 'Bearer wrong' } })).status, 401)
})

test('HTTP: a malformed path gets 400 and the hub stays up', async () => {
  const { request } = await import('node:http')
  const status = await new Promise((resolve, reject) => {
    request(`${base}/`, { path: '//' }, (res) => { res.resume(); resolve(res.statusCode) }).on('error', reject).end()
  })
  assert.equal(status, 400)
  assert.equal((await fetch(`${base}/healthz`)).status, 200)
})

test('HTTP: put over the wire, read it back, delete it', async () => {
  const h = { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }
  const put = await fetch(`${base}/v1/cards/remote`, { method: 'PUT', headers: h, body: JSON.stringify({ title: 'Remote', value: 3 }) })
  assert.equal(put.status, 200)
  const list = await (await fetch(`${base}/v1/cards`, { headers: h })).json()
  const card = list.cards.find((c) => c.id === 'remote')
  assert.equal(card.value, '3')
  assert.equal(typeof card.ageSec, 'number')
  const bad = await fetch(`${base}/v1/cards/remote2`, { method: 'PUT', headers: h, body: JSON.stringify({ value: 1 }) })
  assert.equal(bad.status, 400)
  assert.equal((await fetch(`${base}/v1/cards/remote`, { method: 'DELETE', headers: h })).status, 200)
  assert.equal((await fetch(`${base}/v1/cards/remote`, { headers: h })).status, 404)
})

test('feeds tag their cards with the feed name', async () => {
  const cards = await runFeed({ name: 'demo', run: async () => [{ id: 'demo-a', title: 'A' }, null] })
  assert.equal(cards.length, 1)
  assert.equal(store.getCard('demo-a').source, 'feed:demo')
})
