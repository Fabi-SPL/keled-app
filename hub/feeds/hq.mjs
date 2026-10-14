// Lucid HQ on this PC. GETs only. HQ keeps no unread flag: a session is unread when it
// changed after his read mark (lucid-read.ts), and a busy session is running, not waiting.
import { getJson, ago } from './_http.mjs'

const BASE = process.env.KELED_HQ_URL || 'http://127.0.0.1:4612'
const UI = 'https://fabi-pc.taildd1460.ts.net:8443'

export default {
  every: 120,
  async run() {
    const [sessions, status, marks] = await Promise.all([
      getJson(`${BASE}/session`),
      getJson(`${BASE}/session/status`).catch(() => ({})),
      getJson(`${BASE}/lucid/read`).catch(() => ({ floor: 0, read: {} })),
    ])
    const top = sessions.filter((s) => !s.parentID && !s.time?.archived)
    const busy = top.filter((s) => status[s.id]?.type === 'busy')
    const unread = top
      .filter((s) => !status[s.id] && s.time.updated > Math.max(marks.floor ?? 0, marks.read?.[s.id] ?? 0))
      .sort((a, b) => b.time.updated - a.time.updated)

    return {
      id: 'hq',
      app: 'Lucid HQ',
      title: 'HQ',
      symbol: 'rectangle.stack.fill',
      kind: 'list',
      tint: unread.length ? 'warn' : busy.length ? 'accent' : 'ok',
      value: String(unread.length),
      label: 'unread',
      caption: busy.length ? `${busy.length} running now` : 'nothing running',
      items: unread.slice(0, 4).map((s) => ({
        title: String(s.title || s.slug || 'Session'),
        detail: ago(new Date(s.time.updated).toISOString()),
        tint: 'warn',
      })),
      url: UI,
      staleAfter: 900,
      order: 5,
    }
  },
}
