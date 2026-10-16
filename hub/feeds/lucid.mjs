// Lucid companion app (Companion Skeleton) on this PC. Its cookie is sha256(password + salt),
// so the feed derives it from that app's own .env instead of keeping a second copy of the secret.
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
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

const CLI_DIR = process.env.KELED_LUCID_CLI_DIR || 'C:/Programs/Claude/ee-personal-app'

// The widget draws each habit as a glyph with a one-word name; both come from the habit's own name.
const GLYPHS = [
  [/cardio|train|run|gym|sport/i, 'figure.run', 'Cardio'],
  [/cook|meal|food|eat/i, 'fork.knife', 'Cook'],
  [/outside|ride|walk|bike/i, 'bicycle', 'Outside'],
  [/read|book/i, 'book', 'Read'],
  [/sleep|bed/i, 'bed.double', 'Sleep'],
  [/water|drink/i, 'drop', 'Water'],
]
const bare = (name) => String(name).replace(/[^\p{L}\p{N}\s/&'-]/gu, '').trim()
export function habitLook(name) {
  const hit = GLYPHS.find(([re]) => re.test(name))
  const short = hit ? hit[2] : (bare(name).split(/\s+/)[0] || 'Habit')
  const slug = short.toLowerCase().replace(/[^a-z0-9]/g, '').padEnd(3, 'x').slice(0, 24)
  return { symbol: hit ? hit[1] : 'circle', short, slug }
}

async function today() {
  const t = await getJson(`${BASE}/api/lucid/today`, { headers: { cookie: cookie() }, redirect: 'manual' })
  if (!t.ok) throw new Error(t.error || 'lucid/today not ok')
  return t
}

const berlinDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())

// sync-to-app.ts habit-done toggles, so it only runs when the habit is not already in the asked state.
function toggle(name) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/sync-to-app.ts', 'habit-done', name, '--date', berlinDay()],
      { cwd: CLI_DIR, timeout: 60000, windowsHide: true }, (err, stdout, stderr) => {
        if (err) return reject(new Error(String(stderr || err.message).trim().split('\n').pop()))
        const out = String(stdout)
        if (/No habit matching/.test(out)) return reject(new Error('no such habit'))
        resolve(out)
      })
  })
}

export default {
  refresh: '15m',
  every: 600,
  async run() {
    const t = await today()
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
        .map((h) => {
          const look = habitLook(h.name)
          return {
            title: `${h.emoji ? h.emoji + ' ' : ''}${h.name}`,
            detail: h.done ? 'done' : 'open',
            tag: look.short,
            symbol: look.symbol,
            on: !!h.done,
            action: `habit:${look.slug}`,
            tint: h.done ? 'ok' : undefined,
          }
        }),
      data: { done: String(done), total: String(habits.length) },
      url: UI,
      staleAfter: 3600,
      order: 1,
    }
  },
  async act({ name, arg, on }) {
    if (name !== 'habit') throw new Error(`unknown action ${name}`)
    const habit = ((await today()).habits ?? []).find((h) => habitLook(h.name).slug === arg)
    if (!habit) throw new Error('no such habit')
    if (!!habit.done === on) return { message: on ? 'Already done' : 'Already open' }
    await toggle(bare(habit.name).split('/')[0].trim() || habit.name)
    return { message: on ? `${habitLook(habit.name).short} done` : `${habitLook(habit.name).short} undone` }
  },
}
