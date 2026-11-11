import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs, { mkdtempSync, readFileSync, readdirSync, rmSync, copyFileSync, existsSync } from 'node:fs'
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
  const faces = readdirSync(join(ROOT, 'hub', 'assets')).filter((n) => /^kel-[a-z0-9-]+\.jpg$/.test(n))
  assert.ok(faces.length >= 15, `only ${faces.length} Kel faces in hub/assets`)
  faces.forEach((n) => wanted.add(n))
  for (const name of wanted) assert.ok(shipped.has(name), `missing bundled ${name}`)
  for (const n of faces) assert.ok(readFileSync(join(ROOT, 'hub', 'assets', n)).equals(readFileSync(join(BUNDLED, n))), `bundled ${n} differs from the hub's`)
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

test('a Kel the office drew gets a hub face with the same crop as the hand-made ones', async (t) => {
  const { makeKelFace, OFFICE_FACES } = await import('../kelfaces.mjs')
  const face = join(OFFICE_FACES, 'hazel-face.webp')
  if (!existsSync(face)) return t.skip('office portraits are not on this machine')
  const tmp = mkdtempSync(join(tmpdir(), 'keled-kelface-'))
  try {
    copyFileSync(face, join(tmp, 'newkel-face.webp'))
    const bun = mkdtempSync(join(tmpdir(), 'keled-kelbundle-'))
    assert.equal(await makeKelFace('newkel', { src: tmp, out: tmp, bundle: bun }), true)
    const made = readFileSync(join(tmp, 'kel-newkel.jpg'))
    assert.ok(readFileSync(join(bun, 'kel-newkel.jpg')).equals(made), 'the app bundle gets the same face')
    rmSync(join(bun, 'kel-newkel.jpg'))
    assert.equal(await makeKelFace('newkel', { src: tmp, out: tmp, bundle: bun }), false)
    assert.ok(existsSync(join(bun, 'kel-newkel.jpg')), 'a missing bundle twin is put back without redrawing')
    rmSync(bun, { recursive: true, force: true })
    assert.ok(made.equals(readFileSync(join(ROOT, 'hub', 'assets', 'kel-hazel.jpg'))), 'crop or JPEG settings drifted from the hand-made faces')
    assert.equal(await makeKelFace('newkel', { src: tmp, out: tmp }), false, 'an unchanged office face is never redrawn')
    assert.equal(await makeKelFace('nobody', { src: tmp, out: tmp }), false, 'no office face, no picture')
    assert.equal(await makeKelFace('../x', { src: tmp, out: tmp }), false)
  } finally { rmSync(tmp, { recursive: true, force: true }) }
})

test('a face the hub drew follows the office redraw; a hand-cut face never changes', async (t) => {
  const { makeKelFace, OFFICE_FACES } = await import('../kelfaces.mjs')
  const [hazel, rosa] = ['hazel', 'rosa'].map((k) => join(OFFICE_FACES, `${k}-face.webp`))
  if (!existsSync(hazel) || !existsSync(rosa)) return t.skip('office portraits are not on this machine')
  const tmp = mkdtempSync(join(tmpdir(), 'keled-kelredraw-'))
  const bun = mkdtempSync(join(tmpdir(), 'keled-kelbundle-'))
  try {
    copyFileSync(hazel, join(tmp, 'newkel-face.webp'))
    assert.equal(await makeKelFace('newkel', { src: tmp, out: tmp, bundle: bun }), true)
    copyFileSync(rosa, join(tmp, 'newkel-face.webp'))
    assert.equal(await makeKelFace('newkel', { src: tmp, out: tmp, bundle: bun }), true, 'the office redrew her, so the hub redraws')
    const rosaHub = readFileSync(join(ROOT, 'hub', 'assets', 'kel-rosa.jpg'))
    assert.ok(readFileSync(join(tmp, 'kel-newkel.jpg')).equals(rosaHub), 'the redraw is the new face')
    assert.ok(readFileSync(join(bun, 'kel-newkel.jpg')).equals(rosaHub), 'the bundle twin follows the redraw')

    const handCut = Buffer.from('a hand-cut jpg the hub would never draw')
    copyFileSync(hazel, join(tmp, 'cut-face.webp'))
    fs.writeFileSync(join(tmp, 'kel-cut.jpg'), handCut)
    assert.equal(await makeKelFace('cut', { src: tmp, out: tmp }), false)
    copyFileSync(rosa, join(tmp, 'cut-face.webp'))
    assert.equal(await makeKelFace('cut', { src: tmp, out: tmp }), false)
    assert.ok(readFileSync(join(tmp, 'kel-cut.jpg')).equals(handCut), 'a hand-cut face survives an office redraw')
    assert.deepEqual(JSON.parse(readFileSync(join(tmp, 'kelfaces.json'), 'utf8')).cut, { hand: true })

    copyFileSync(hazel, join(tmp, 'seen-face.webp'))
    copyFileSync(join(ROOT, 'hub', 'assets', 'kel-hazel.jpg'), join(tmp, 'kel-seen.jpg'))
    assert.equal(await makeKelFace('seen', { src: tmp, out: tmp }), false, 'a face the hub would draw as it is gets recorded, not redrawn')
    copyFileSync(rosa, join(tmp, 'seen-face.webp'))
    assert.equal(await makeKelFace('seen', { src: tmp, out: tmp }), true, 'and then follows the office like one it drew')
  } finally { rmSync(tmp, { recursive: true, force: true }); rmSync(bun, { recursive: true, force: true }) }
})

test('the office feed draws faces off the portrait folder before it asks the office anything', async (t) => {
  const { syncKelFaces, OFFICE_FACES } = await import('../kelfaces.mjs')
  const hazel = join(OFFICE_FACES, 'hazel-face.webp')
  if (!existsSync(hazel)) return t.skip('office portraits are not on this machine')
  const tmp = mkdtempSync(join(tmpdir(), 'keled-kelsync-'))
  try {
    for (const n of ['one', 'two']) copyFileSync(hazel, join(tmp, `${n}-face.webp`))
    fs.writeFileSync(join(tmp, 'one-look.webp'), 'not a face')
    assert.deepEqual((await syncKelFaces({ src: tmp, out: tmp })).sort(), ['one', 'two'])
    assert.deepEqual(await syncKelFaces({ src: tmp, out: tmp }), [], 'nothing changed, nothing drawn')
    const feed = readFileSync(join(ROOT, 'hub', 'feeds', 'office.mjs'), 'utf8')
    assert.ok(feed.includes('syncKelFaces()') && feed.indexOf('syncKelFaces()') < feed.indexOf('getJson('), 'faces before the network call')
  } finally { rmSync(tmp, { recursive: true, force: true }) }
})
