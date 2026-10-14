import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'keled-design-'))
process.env.KELED_WIDGETS_DATA = dir
process.env.KELED_WIDGETS_THEMES = join(dir, 'themes')
process.env.KELED_WIDGETS_ASSETS = join(dir, 'assets')
const store = await import('../store.mjs')
const { createHub } = await import('../server.mjs')

const TOKEN = 'design-token-456'
const H = { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }
let hub, base, target, targetUrl
const hits = []
const feedActs = []
let feedOn = false

const demoFeed = {
  name: 'demo',
  run: async () => [{ id: 'feed-card', title: 'Feed', items: [{ title: 'Lamp', action: `lamp:${feedOn ? 'on' : 'off'}`, on: feedOn }] }],
  act: async ({ name, arg, on }) => { feedActs.push({ name, arg, on }); feedOn = on; return { message: 'Lamp switched' } },
  confirm: ['nuke'],
}

before(async () => {
  target = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      hits.push({ method: req.method, url: req.url, body })
      if (req.url.startsWith('/fail')) { res.writeHead(500); return res.end('boom') }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ message: 'Acked' }))
    })
  })
  await new Promise((r) => target.listen(0, '127.0.0.1', r))
  targetUrl = `http://127.0.0.1:${target.address().port}`
  const { runFeed } = await import('../server.mjs')
  await runFeed(demoFeed)
  hub = createHub({ token: TOKEN, feeds: [demoFeed] })
  await new Promise((r) => hub.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${hub.address().port}`
})
after(() => { hub.close(); target.close(); rmSync(dir, { recursive: true, force: true }) })

const cards = async () => (await (await fetch(`${base}/v1/cards`, { headers: H })).json()).cards
const act = (card, action, on) => fetch(`${base}/v1/actions`, { method: 'POST', headers: H, body: JSON.stringify({ card, action, on }) })

test('a layout tree is validated, unknown keys dropped, typos reported', () => {
  const ok = store.normalizeCard({
    id: 'tax', title: 'Taxes',
    layouts: { small: { type: 'vstack', align: 'leading', junk: 1, children: [
      { type: 'text', text: '{data.due}', size: 40, weight: 'bold', color: 'accent@0.8' },
      { type: 'date', date: '{data.dueAt}', style: 'days' },
    ] } },
  })
  assert.equal(ok.errors, undefined)
  assert.equal(ok.card.layouts.small.junk, undefined)
  assert.equal(ok.card.layouts.small.children[0].color, 'accent@0.8')

  const bad = store.normalizeCard({ id: 'tax', title: 'Taxes', layouts: {
    huge: { type: 'text' },
    small: { type: 'vstack', children: [{ type: 'blink' }, { type: 'text', color: 'pinkish' }, { type: 'button' }, { type: 'text', children: [] }] },
  } })
  const msg = bad.errors.join(' | ')
  assert.match(msg, /layouts\.huge/)
  assert.match(msg, /blink/)
  assert.match(msg, /pinkish/)
  assert.match(msg, /button needs an action/)
  assert.match(msg, /text takes no children/)
})

test('a runaway layout is capped by depth and node count', () => {
  let deep = { type: 'text', text: 'x' }
  for (let i = 0; i < 14; i++) deep = { type: 'vstack', children: [deep] }
  assert.match(store.normalizeCard({ id: 'd', title: 'D', layouts: { small: deep } }).errors.join(), /deeper/)
  const wide = { type: 'vstack', children: Array.from({ length: 24 }, () => ({ type: 'hstack', children: Array.from({ length: 24 }, () => ({ type: 'spacer' })) })) }
  assert.match(store.normalizeCard({ id: 'w', title: 'W', layouts: { large: wide } }).errors.join(), /more than 160 nodes/)
})

test('an app theme dresses every card of that app; card layouts beat theme layouts', async () => {
  store.putTheme('Keled Mail', {
    bg: ['#101014', '#1d1d24'], ink: '#f4f4f6', accent: '#c8a2ff', font: 'serif', numbers: 'mono',
    dark: { bg: '#000000' },
    layouts: {
      small: { type: 'text', text: 'theme small' },
      'list.medium': { type: 'text', text: 'theme list medium' },
      'mail-b.medium': { type: 'text', text: 'theme card medium' },
    },
  })
  assert.throws(() => store.putTheme('x', { bg: 'red' }), /hex only/)
  store.putCard({ id: 'mail-a', title: 'A', app: 'Keled Mail', items: [{ title: 'one' }], layouts: { small: { type: 'text', text: 'card small' } } })
  store.putCard({ id: 'mail-b', title: 'B', app: 'Keled Mail', items: [{ title: 'one' }] })
  store.putCard({ id: 'other', title: 'O', app: 'Elsewhere', theme: { accent: '#ff0000' } })
  const list = await cards()
  const a = list.find((c) => c.id === 'mail-a')
  const b = list.find((c) => c.id === 'mail-b')
  assert.deepEqual(a.theme.bg, ['#101014', '#1d1d24'])
  assert.equal(a.theme.dark.bg[0], '#000000')
  assert.equal(a.layouts.small.text, 'card small')
  assert.equal(a.layouts.medium.text, 'theme list medium')
  assert.equal(b.layouts.small.text, 'theme small')
  assert.equal(b.layouts.medium.text, 'theme card medium')
  assert.equal(list.find((c) => c.id === 'other').theme.accent, '#ff0000')
  assert.equal(a.theme.layouts, undefined)
})

test('handlers never reach the phone and cannot be set over HTTP', async () => {
  store.putCard({
    id: 'alarm', title: 'Alarm',
    items: [{ title: 'Smoke', action: 'ack:a1b2' }],
    do: { ack: { http: { method: 'POST', url: `${targetUrl}/ack/{arg}`, body: { id: '{arg}', on: '{on}' } }, then: 'remove' } },
  })
  const served = (await cards()).find((c) => c.id === 'alarm')
  assert.equal(served.do, undefined)
  const put = await fetch(`${base}/v1/cards/alarm`, { method: 'PUT', headers: H, body: JSON.stringify({
    title: 'Alarm', items: [{ title: 'Smoke', action: 'ack:a1b2' }],
    do: { ack: { run: ['powershell', '-c', 'calc'] } },
  }) })
  assert.equal(put.status, 200)
  assert.equal(store.getCard('alarm').do.ack.http.url, `${targetUrl}/ack/{arg}`)
  assert.equal(store.getCard('alarm').do.ack.run, undefined)
})

test('an http action runs with the arg filled in, then removes its item', async () => {
  hits.length = 0
  const r = await act('alarm', 'ack:a1b2')
  assert.equal(r.status, 200)
  assert.equal((await r.json()).message, 'Acked')
  assert.equal(hits[0].url, '/ack/a1b2')
  assert.deepEqual(JSON.parse(hits[0].body), { id: 'a1b2', on: 'true' })
  assert.equal((store.getCard('alarm').items ?? []).length, 0)
  const served = (await cards()).find((c) => c.id === 'alarm')
  assert.equal(served.flash.text, 'Acked')
  assert.equal(served.flash.tint, 'ok')
})

test('undeclared refs and hostile args are refused before anything runs', async () => {
  store.putCard({ id: 'alarm2', title: 'A2', items: [{ title: 'x', action: 'ack:ok1' }], do: { ack: { http: { url: `${targetUrl}/ack/{arg}` } } } })
  hits.length = 0
  assert.equal((await act('alarm2', 'ack:other')).status, 400)
  assert.equal((await act('alarm2', 'ack:../../etc')).status, 400)
  assert.equal((await act('nope', 'ack:ok1')).status, 404)
  assert.equal(hits.length, 0)
  assert.ok(store.normalizeCard({ id: 'z', title: 'Z', items: [{ title: 'x', action: 'ack:a b' }] }).errors)
})

test('a toggle flips its item on a put card; a failure flashes red', async () => {
  store.putCard({
    id: 'shop', title: 'Shopping',
    items: [{ title: 'Milk', action: 'tick:milk', on: false }],
    actions: [{ id: 'broken', label: 'Break' }],
    do: { tick: { http: { url: `${targetUrl}/tick/{arg}/{on}` } }, broken: { http: { url: `${targetUrl}/fail` } } },
  })
  assert.equal((await act('shop', 'tick:milk', true)).status, 200)
  assert.equal(store.getCard('shop').items[0].on, true)
  assert.equal(hits.at(-1).url, '/tick/milk/true')
  assert.equal((await act('shop', 'broken')).status, 502)
  const served = (await cards()).find((c) => c.id === 'shop')
  assert.equal(served.flash.tint, 'bad')
  assert.match(served.flash.text, /HTTP 500/)
})

test('a confirm action needs a second tap and shows as armed in between', async () => {
  store.putCard({ id: 'office-run', title: 'Office', actions: [{ id: 'start', label: 'Start', confirm: true }],
    do: { start: { http: { url: `${targetUrl}/start` } } } })
  hits.length = 0
  const first = await act('office-run', 'start')
  assert.equal(first.status, 202)
  assert.equal((await first.json()).armed, true)
  assert.equal(hits.length, 0)
  const armed = (await cards()).find((c) => c.id === 'office-run').armed
  assert.ok(armed.start > Date.now())
  assert.equal((await act('office-run', 'start')).status, 200)
  assert.equal(hits.length, 1)
})

test('a feed card action goes to the feed and the feed re-reads the truth', async () => {
  const r = await act('feed-card', 'lamp:off', true)
  assert.equal(r.status, 200)
  assert.deepEqual(feedActs.at(-1), { name: 'lamp', arg: 'off', on: true })
  const card = store.getCard('feed-card')
  assert.equal(card.items[0].on, true)
  assert.equal(card.items[0].action, 'lamp:on')
  assert.equal(card.source, 'feed:demo')
})

test('assets are served by name only', async () => {
  mkdirSync(join(dir, 'assets'), { recursive: true })
  writeFileSync(join(dir, 'assets', 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  const r = await fetch(`${base}/v1/assets/logo.png`, { headers: H })
  assert.equal(r.status, 200)
  assert.equal(r.headers.get('content-type'), 'image/png')
  assert.equal((await fetch(`${base}/v1/assets/logo.png`)).status, 401)
  assert.equal((await fetch(`${base}/v1/assets/..%2Fcards`, { headers: H })).status, 404)
})
