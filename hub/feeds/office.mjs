// Keled Office daemon on this PC. Read-only GETs on its local API.
import { getJson, ago, plural } from './_http.mjs'

const BASE = process.env.KELED_OFFICE_URL || 'http://127.0.0.1:4640'
const UI = 'https://fabi-pc.taildd1460.ts.net:3456'

export default {
  refresh: '5m',
  every: 120,
  async run() {
    const [state, asks, decisions] = await Promise.all([
      getJson(`${BASE}/api/state`),
      getJson(`${BASE}/api/ask?open=1`).catch(() => ({ items: [] })),
      getJson(`${BASE}/api/decisions`).catch(() => ({ items: [], queued: 0 })),
    ])
    const counts = state.backlog?.counts ?? {}
    // budget.stopped is the STOP file; `running` only covers the old cycle mode.
    const stopped = !!state.budget?.stopped
    const agents = Object.entries(state.agents ?? {})
    // 'resting' is the office plateau, not work: count it with idle.
    const busy = (a) => !!a.status && a.status !== 'idle' && a.status !== 'resting'
    const working = agents.filter(([, a]) => busy(a))
    const forYou = (asks.items?.length ?? 0) + (decisions.items?.length ?? 0) + (counts.needs_fabi ?? 0)
    const lastAt = state.feed?.[0]?.at

    const agentRows = [...working, ...agents.filter(([, a]) => !busy(a))]
      .slice(0, 6)
      .map(([name, a]) => ({
        title: name[0].toUpperCase() + name.slice(1),
        detail: a.task ? String(a.task.title ?? a.task) : a.lastError ? 'error' : a.status || 'idle',
        tag: busy(a) ? a.status : undefined,
        tint: a.lastError ? 'bad' : busy(a) ? 'ok' : undefined,
        image: `kel-${name.toLowerCase()}.jpg`,
        on: busy(a),
      }))

    return [
      {
        id: 'office',
        app: 'Keled Office',
        title: 'Office',
        symbol: 'building.2.fill',
        kind: 'status',
        tint: stopped ? 'neutral' : working.length ? 'ok' : 'accent',
        value: stopped ? 'Stopped' : working.length ? `${working.length} busy` : 'Live',
        label: stopped ? 'STOP file' : 'agents',
        caption: [
          counts.blocked_with_me ? `${counts.blocked_with_me} you hold` : null,
          counts.assigned ? `${counts.assigned} assigned` : null,
          counts.review ? `${counts.review} in review` : null,
          lastAt ? `last ${ago(lastAt)}` : null,
        ].filter(Boolean).join(' · ') || 'quiet',
        items: agentRows,
        data: {
          busy: String(working.length),
          hold: String(counts.blocked_with_me ?? 0),
          assigned: String(counts.assigned ?? 0),
          last: lastAt ? ago(lastAt) : '',
          who: agentRows[0]?.title ?? '',
          task: agentRows[0] && working.length ? agentRows[0].detail : '',
        },
        url: UI,
        staleAfter: 900,
        order: 20,
      },
      {
        id: 'office-asks',
        app: 'Keled Office',
        title: 'Asks',
        symbol: 'questionmark.bubble.fill',
        kind: 'metric',
        tint: forYou ? 'warn' : 'ok',
        value: String(forYou),
        label: 'for you',
        caption: forYou ? `${plural(asks.items?.length ?? 0, 'question')}, ${plural(decisions.items?.length ?? 0, 'decision')}` : 'nothing waiting',
        url: UI,
        staleAfter: 900,
        order: 21,
      },
    ]
  },
}
