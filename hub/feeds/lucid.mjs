// Lucid companion app (Companion Skeleton) on this PC. Its cookie is sha256(password + salt),
// so the feed derives it from that app's own .env instead of keeping a second copy of the secret.
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { getJson } from './_http.mjs'

const BASE = process.env.KELED_LUCID_URL || 'http://127.0.0.1:5274'
const ENV = process.env.KELED_LUCID_ENV || 'C:/Programs/Claude/Companion Skeleton/.env'
const UI = 'https://fabi-pc.taildd1460.ts.net'

function cookie() {
  const env = Object.fromEntries(
    readFileSync(ENV, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
      .filter(Boolean)
      .map(([, k, v]) => [k, v.replace(/^(['"])(.*)\1$/, '$2')]),
  )
  if (!env.LUCID_COMPANION_PASSWORD) throw new Error('LUCID_COMPANION_PASSWORD missing from companion .env')
  const salt = 'lucid-companion-v1-' + (env.LUCID_COMPANION_AUTH_SALT || 'default-salt')
  return `lucid_companion_auth=${createHash('sha256').update(env.LUCID_COMPANION_PASSWORD + salt).digest('hex').slice(0, 48)}`
}

export default {
  every: 600,
  async run() {
    const t = await getJson(`${BASE}/api/lucid/today`, { headers: { cookie: cookie() }, redirect: 'manual' })
    if (!t.ok) throw new Error(t.error || 'lucid/today not ok')
    const habits = t.habits ?? []
    const done = habits.filter((h) => h.done).length

    return {
      id: 'lucid',
      app: 'Lucid',
      title: 'Today',
      symbol: 'sparkles',
      kind: 'list',
      tint: habits.length && done === habits.length ? 'ok' : 'accent',
      value: `${done}/${habits.length}`,
      label: 'habits',
      progress: habits.length ? done / habits.length : 0,
      caption: t.focus?.title ? `Focus: ${t.focus.title}` : `${t.done_today ?? 0} threads done today`,
      items: habits
        .slice()
        .sort((a, b) => Number(a.done) - Number(b.done))
        .slice(0, 4)
        .map((h) => ({ title: `${h.emoji ? h.emoji + ' ' : ''}${h.name}`, detail: h.done ? 'done' : 'open', tint: h.done ? 'ok' : undefined })),
      url: UI,
      staleAfter: 3600,
      order: 1,
    }
  },
}
