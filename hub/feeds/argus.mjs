// Argus home-network posture on the Hetzner box. GET /api/posture only; POST /api/invoke
// is the one route that changes a device, so the feed never touches it.
import { getJson } from './_http.mjs'

const BASE = process.env.KELED_ARGUS_URL || 'https://hetzner-lucid.taildd1460.ts.net:9443'
const TINT = { ok: 'ok', warn: 'warn', bad: 'bad', fail: 'bad', unknown: 'neutral' }
const RANK = { bad: 0, fail: 0, warn: 1, unknown: 2, ok: 3 }

export default {
  refresh: '30m',
  every: 900,
  async run() {
    const p = await getJson(`${BASE}/api/posture`, { timeoutMs: 60000 })
    const checks = [...(p.checks ?? [])].sort((a, b) => (RANK[a.level] ?? 2) - (RANK[b.level] ?? 2))
    const open = checks.filter((c) => c.level !== 'ok').length
    const verdict = String(p.verdict ?? 'unknown')

    return {
      id: 'argus',
      app: 'Argus',
      title: 'Network',
      symbol: 'network',
      kind: 'status',
      tint: TINT[verdict] ?? 'neutral',
      value: verdict === 'ok' ? 'OK' : verdict[0].toUpperCase() + verdict.slice(1),
      label: open ? `${open} to check` : 'all clear',
      caption: p.headline,
      items: checks.slice(0, 4).map((c) => ({ title: String(c.title), tag: c.device, tint: TINT[c.level] })),
      url: BASE,
      staleAfter: 3600,
      order: 70,
    }
  },
}
