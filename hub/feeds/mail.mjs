// Keled Mail on hetzner-lucid. Read-only: /api/accounts and /api/claude only.
// Never call /api/claude/take, it removes the labels.
import { getJson, plural } from './_http.mjs'

const BASE = process.env.KELED_MAIL_URL || 'https://hetzner-lucid.taildd1460.ts.net:10443'

export default {
  every: 300,
  async run() {
    const [{ accounts = [] }, { threads = [] }] = await Promise.all([
      getJson(`${BASE}/api/accounts`),
      getJson(`${BASE}/api/claude`),
    ])
    const needsYou = accounts.reduce((n, a) => n + (a.unread_needs_you || 0), 0)
    const broken = accounts.filter((a) => a.state && a.state !== 'ok')
    // Workspace boxes first: those are the business ones, the personal Gmails sit at thousands unread.
    const ranked = [...accounts].sort((a, b) =>
      (b.unread_needs_you || 0) - (a.unread_needs_you || 0) ||
      (a.kind === 'workspace' ? -1 : 1) - (b.kind === 'workspace' ? -1 : 1))

    return [
      {
        id: 'mail',
        app: 'Keled Mail',
        title: 'Mail',
        symbol: 'envelope.fill',
        kind: 'list',
        tint: broken.length ? 'bad' : needsYou ? 'warn' : 'ok',
        value: String(needsYou),
        label: 'need you',
        caption: broken.length
          ? `${broken.map((a) => a.code).join(', ')} not syncing`
          : `${plural(threads.length, 'thread')} marked for Claude`,
        items: ranked.slice(0, 6).map((a) => ({
          title: a.code,
          detail: a.unread_needs_you ? `${a.unread_needs_you} need you` : a.state === 'ok' ? 'clear' : a.state,
          tag: String(a.unread ?? 0),
          tint: a.state !== 'ok' ? 'bad' : a.unread_needs_you ? 'warn' : undefined,
        })),
        url: `${BASE}/`,
        staleAfter: 1800,
        order: 10,
      },
      {
        id: 'mail-claude',
        app: 'Keled Mail',
        title: 'For Claude',
        symbol: 'tag.fill',
        kind: 'metric',
        tint: threads.length ? 'accent' : 'neutral',
        value: String(threads.length),
        label: 'marked',
        caption: threads[0]?.subject ? String(threads[0].subject) : 'nothing marked',
        url: `${BASE}/`,
        staleAfter: 1800,
        order: 11,
      },
    ]
  },
}
