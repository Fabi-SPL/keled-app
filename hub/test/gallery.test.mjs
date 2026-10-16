import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = mkdtempSync(join(tmpdir(), 'keled-gallery-'))
process.env.KELED_WIDGETS_DATA = dir
const { build, gallerySwift, GROUPS } = await import('../designs/build.mjs')
const { createHub } = await import('../server.mjs')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const BUNDLED = join(ROOT, 'ios', 'Shared', 'Bundled')
const TOKEN = 'gallery-token-789'
const built = build()
let hub, base

before(async () => {
  hub = createHub({ token: TOKEN })
  await new Promise((r) => hub.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${hub.address().port}`
})
after(() => { hub.close(); rmSync(dir, { recursive: true, force: true }) })

test('all 53 designs validate with the hub rules', () => {
  assert.deepEqual(built.errors, [])
  assert.equal(built.designs.length, 53)
  assert.deepEqual(built.designs.map((d) => d.n), Array.from({ length: 53 }, (_, i) => i + 1))
})

test('every design sits in a known group and every group has one', () => {
  const groups = new Set(GROUPS.map(([g]) => g))
  for (const d of built.designs) assert.ok(groups.has(d.group), `${d.id} group ${d.group}`)
  for (const g of groups) assert.ok(built.designs.some((d) => d.group === g), `empty group ${g}`)
})

test('the built files are current (run node hub/designs/build.mjs)', () => {
  const served = JSON.parse(readFileSync(join(ROOT, 'hub', 'designs', 'designs.json'), 'utf8'))
  assert.equal(served.version, built.version)
  assert.deepEqual(JSON.parse(readFileSync(join(BUNDLED, 'designs.json'), 'utf8')), served)
  assert.equal(readFileSync(join(ROOT, 'ios', 'KeledWidgets', 'Gallery.swift'), 'utf8').replace(/\r\n/g, '\n'), gallerySwift(built.designs).swift)
  assert.deepEqual(JSON.parse(readFileSync(join(BUNDLED, 'preview-cards.json'), 'utf8')), JSON.parse(JSON.stringify(built.cards)))
})

test('fixed images ship in the app; his photos never do', () => {
  const shipped = new Set(readdirSync(BUNDLED))
  assert.ok(![...shipped].some((f) => f.startsWith('wall-')), 'a wallpaper is in the app bundle')
  const wanted = new Set()
  const walk = (n) => { if (n.type === 'image' && n.src && !n.src.includes('{')) wanted.add(n.src); (n.children ?? []).forEach(walk) }
  built.designs.forEach((d) => walk(d.layout))
  for (const k of ['ada', 'ivy', 'lena', 'mira', 'nora', 'thea']) wanted.add(`kel-${k}.jpg`)
  for (const name of wanted) assert.ok(shipped.has(name), `missing bundled ${name}`)
  const ignore = readFileSync(join(ROOT, '.gitignore'), 'utf8')
  assert.match(ignore, /^hub\/assets\/wall-\*$/m)
})

test('preview cards carry every field the designs read from data', () => {
  const byId = Object.fromEntries(built.cards.map((c) => [c.id, c]))
  for (const d of built.designs) {
    const text = JSON.stringify(d.layout)
    for (const [, key] of text.matchAll(/\{data\.([a-zA-Z]+)\}/g)) {
      const ids = d.cards.includes('*') ? Object.keys(byId) : d.cards
      assert.ok(ids.some((id) => byId[id]?.data?.[key] !== undefined), `${d.id} reads data.${key}`)
    }
  }
})

test('GET /v1/designs needs the token and serves the build', async () => {
  assert.equal((await fetch(`${base}/v1/designs`)).status, 401)
  const r = await fetch(`${base}/v1/designs`, { headers: { authorization: `Bearer ${TOKEN}` } })
  assert.equal(r.status, 200)
  const body = await r.json()
  assert.equal(body.version, built.version)
  assert.equal(body.designs.length, 53)
  const cards = await (await fetch(`${base}/v1/cards`, { headers: { authorization: `Bearer ${TOKEN}` } })).json()
  assert.equal(cards.designs, built.version)
})

test('one gallery entry per group, at most seven per bundle', () => {
  const { swift, bundles } = gallerySwift(built.designs)
  assert.equal((swift.match(/: Widget \{/g) ?? []).length, GROUPS.length)
  assert.equal(bundles, Math.ceil(GROUPS.length / 7))
  assert.match(swift, /struct KeledGallery: WidgetBundle/)
})
