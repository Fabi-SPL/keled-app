// Olympus board app on this PC. Only the read-only api names `list` and `get`;
// everything else on that API writes or spends.
import { getJson, ago } from './_http.mjs'

const BASE = process.env.OLYMPUS_URL || 'http://127.0.0.1:7830'
const UI = 'https://fabi-pc.taildd1460.ts.net:7830'

const call = (name, arg) => getJson(`${BASE}/api/${name}`, {
  method: 'POST',
  headers: { 'x-olympus': '1', 'content-type': 'application/json' },
  body: JSON.stringify(arg === undefined ? {} : { arg }),
})

export default {
  refresh: '30m',
  every: 600,
  async run() {
    const list = await call('list')
    const meetings = list.value ?? []
    const last = meetings.find((m) => m.state === 'done') ?? meetings[0]
    if (!last) {
      return { id: 'olympus', app: 'Olympus', title: 'Board', symbol: 'building.columns.fill', kind: 'status', tint: 'neutral', value: 'None', label: 'meetings', url: UI, order: 30 }
    }
    const detail = (await call('get', last.id).catch(() => null))?.value ?? {}
    const tally = last.votes?.tally ?? detail.votes?.tally ?? []
    const carried = tally.filter((t) => t.carried).length
    const held = detail.office?.held ?? last.office?.held ?? []
    // notes is keyed by motion index ({"0": {verdict: "take"}}); a verdict means he already decided it.
    const decided = new Set(Object.entries(detail.notes ?? {}).filter(([, n]) => n?.verdict).map(([k]) => Number(k)))
    const waiting = held.filter((h) => !decided.has(Number(h.i)))
    const running = meetings.filter((m) => m.state && m.state !== 'done').length

    return {
      id: 'olympus',
      app: 'Olympus',
      title: 'Board',
      symbol: 'building.columns.fill',
      kind: 'list',
      tint: waiting.length ? 'warn' : running ? 'accent' : 'ok',
      value: tally.length ? `${carried}/${tally.length}` : '–',
      label: 'carried',
      caption: running ? `${running} meeting live now` : detail.brief?.next ? String(detail.brief.next) : `${last.title} · ${ago(last.at)}`,
      items: [
        { title: String(last.title ?? 'Last meeting'), detail: ago(detail.status?.finishedAt ?? last.at), tag: last.domain },
        ...waiting.slice(0, 4).map((h) => ({
          title: typeof h.move === 'string' ? h.move : String(h.move?.title ?? h.move?.text ?? `Motion ${Number(h.i) + 1}`),
          detail: 'waiting on you',
          tag: 'held',
          tint: 'warn',
        })),
      ],
      url: UI,
      staleAfter: 3600,
      order: 30,
    }
  },
}
