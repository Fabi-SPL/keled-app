import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { dirname } from 'node:path'

// Outside the repo: the repo is public, the token is what keeps the cards private.
export const SECRET_FILE = process.env.KELED_WIDGETS_SECRET || 'C:/Programs/Claude/.secrets/keled-widgets.json'
export const PORT = Number(process.env.KELED_WIDGETS_PORT || 7840)
export const PUBLIC_URL = process.env.KELED_WIDGETS_URL || `https://fabi-pc.taildd1460.ts.net:${PORT}`

export function loadSecret({ create = false } = {}) {
  if (existsSync(SECRET_FILE)) return JSON.parse(readFileSync(SECRET_FILE, 'utf8'))
  if (!create) return null
  const secret = { token: randomBytes(24).toString('base64url'), createdAt: new Date().toISOString() }
  mkdirSync(dirname(SECRET_FILE), { recursive: true })
  writeFileSync(SECRET_FILE, JSON.stringify(secret, null, 2))
  return secret
}
