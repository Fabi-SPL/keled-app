// A Kel the office has drawn but the hub has no picture for gets kel-<id>.jpg made from the office face.
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { ASSETS_DIR } from './store.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const OFFICE_FACES = process.env.KELED_KEL_FACES || 'C:/Programs/Claude/keled-office/ui/webview-ui/public/kels'
const PYTHON = process.env.KELED_PYTHON || 'python'
const pending = new Map()

export function makeKelFace(id, { src = OFFICE_FACES, out = ASSETS_DIR } = {}) {
  id = String(id).toLowerCase()
  if (!/^[a-z0-9-]{1,40}$/.test(id)) return Promise.resolve(false)
  const dest = join(out, `kel-${id}.jpg`)
  const face = join(src, `${id}-face.webp`)
  if (pending.has(dest)) return pending.get(dest)
  if (existsSync(dest) || !existsSync(face)) return Promise.resolve(false)
  const job = new Promise((resolve) => {
    const p = spawn(PYTHON, [join(HERE, 'kelface.py'), face, dest], { windowsHide: true, stdio: 'ignore' })
    p.on('error', () => resolve(false))
    p.on('exit', (code) => resolve(code === 0 && existsSync(dest)))
  }).finally(() => pending.delete(dest))
  pending.set(dest, job)
  return job
}
