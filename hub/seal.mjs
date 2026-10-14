// Seals preview payloads for the public CI repo: AES-256-GCM, key from KELED_PREVIEW_KEY (64 hex chars).
// Real cards and their screenshots only ever cross GitHub sealed; run logs and artifacts are public.
//   node hub/seal.mjs seal < plain > sealed      node hub/seal.mjs open < sealed > plain
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const KEY_FILE = 'C:/Programs/Claude/.secrets/keled-preview.key'
const MAGIC = Buffer.from('KLD1')

export function previewKey(env = process.env) {
  const hex = (env.KELED_PREVIEW_KEY || (existsSync(KEY_FILE) ? readFileSync(KEY_FILE, 'utf8') : '')).trim()
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error(`no preview key: set KELED_PREVIEW_KEY or write 64 hex chars to ${KEY_FILE}`)
  return Buffer.from(hex, 'hex')
}

export function seal(plain, key = previewKey()) {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key, iv)
  const body = Buffer.concat([c.update(plain), c.final()])
  return Buffer.concat([MAGIC, iv, c.getAuthTag(), body])
}

export function open(sealed, key = previewKey()) {
  if (!sealed.subarray(0, 4).equals(MAGIC)) throw new Error('not a sealed payload')
  const d = createDecipheriv('aes-256-gcm', key, sealed.subarray(4, 16))
  d.setAuthTag(sealed.subarray(16, 32))
  return Buffer.concat([d.update(sealed.subarray(32)), d.final()])
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2]
  if (mode !== 'seal' && mode !== 'open') { console.error('usage: seal.mjs seal|open < in > out'); process.exit(2) }
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  process.stdout.write((mode === 'seal' ? seal : open)(Buffer.concat(chunks)))
}
