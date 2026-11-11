// A Kel the office has drawn gets kel-<id>.jpg made from the office face, plus the same file in the app bundle
// so the next build ships it without a hand copy. A face the hub made itself is redrawn when the office redraws
// hers (Nova and Paula, 2026-11-11). The six hand-cut originals (98ba0fc) are never touched: the first look at
// an existing face records whether the hub would have drawn exactly it ({ src }) or a hand did ({ hand }).
import { existsSync, copyFileSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { ASSETS_DIR, DATA_DIR } from './store.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const OFFICE_FACES = process.env.KELED_KEL_FACES || 'C:/Programs/Claude/keled-office/ui/webview-ui/public/kels'
export const BUNDLED = join(HERE, '..', 'ios', 'Shared', 'Bundled')
const PYTHON = process.env.KELED_PYTHON || 'python'
const pending = new Map()

const sha = (f) => createHash('sha1').update(readFileSync(f)).digest('hex')
const same = (a, b) => existsSync(a) && existsSync(b) && readFileSync(a).equals(readFileSync(b))

function readBook(file) {
  try { const s = readFileSync(file, 'utf8'); return /^\s*\{/.test(s) ? JSON.parse(s) : {} } catch { return {} }
}
function writeBook(file, book) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(`${file}.part`, JSON.stringify(book, null, 1))
  copyFileSync(`${file}.part`, file)
  rmSync(`${file}.part`, { force: true })
}

function twin(dest, bundle, redrawn = false) {
  if (!bundle) return
  const to = join(bundle, dest.split(/[\\/]/).pop())
  try { if (existsSync(bundle) && (!existsSync(to) || (redrawn && !same(dest, to)))) copyFileSync(dest, to) } catch {}
}

function draw(face, to) {
  return new Promise((resolve) => {
    const p = spawn(PYTHON, [join(HERE, 'kelface.py'), face, to], { windowsHide: true, stdio: 'ignore' })
    p.on('error', () => resolve(false))
    p.on('exit', (code) => resolve(code === 0 && existsSync(to)))
  })
}

export function makeKelFace(id, { src = OFFICE_FACES, out = ASSETS_DIR, bundle = out === ASSETS_DIR ? BUNDLED : null, book = join(out === ASSETS_DIR ? DATA_DIR : out, 'kelfaces.json') } = {}) {
  id = String(id).toLowerCase()
  if (!/^[a-z0-9-]{1,40}$/.test(id)) return Promise.resolve(false)
  const dest = join(out, `kel-${id}.jpg`)
  const face = join(src, `${id}-face.webp`)
  if (pending.has(dest)) return pending.get(dest)
  if (!existsSync(face)) { if (existsSync(dest)) twin(dest, bundle); return Promise.resolve(false) }
  const job = (async () => {
    const seen = readBook(book)
    const now = sha(face)
    const was = seen[id]
    if (existsSync(dest)) {
      if (!was) {
        const probe = `${dest}.probe.jpg`
        const drawn = await draw(face, probe)
        seen[id] = drawn && same(probe, dest) ? { src: now } : { hand: true }
        rmSync(probe, { force: true })
        writeBook(book, seen)
      }
      if (seen[id].hand || seen[id].src === now) { twin(dest, bundle); return false }
    }
    if (!(await draw(face, dest))) return false
    writeBook(book, { ...readBook(book), [id]: { src: now } })
    twin(dest, bundle, true)
    return true
  })().finally(() => pending.delete(dest))
  pending.set(dest, job)
  return job
}

// Every face the office has drawn, read off its folder: no network, so a slow /api/state (2026-11-11, >15 s)
// never holds back a new hire or a redraw. Resolves to the ids it drew.
export async function syncKelFaces(opts = {}) {
  const src = opts.src ?? OFFICE_FACES
  let names = []
  try { names = readdirSync(src) } catch { return [] }
  const ids = names.map((f) => /^([a-z0-9-]{1,40})-face\.webp$/.exec(f)?.[1]).filter(Boolean)
  const drawn = []
  for (const id of ids) if (await makeKelFace(id, opts)) drawn.push(id)
  return drawn
}
