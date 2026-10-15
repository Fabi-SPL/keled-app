// Lucid TV on this PC, alerts only: its weather, HQ and mail tiles already have their own
// card or an iOS widget. Anything on the PC can raise a TV alert, so this is the alarm card.
// Each alert row has a tick that clears it on the TV too (POST /api/alert/ack, loopback only).
import { getJson, ago } from './_http.mjs'

const BASE = process.env.KELED_TV_URL || 'http://127.0.0.1:7480'
const UI = 'https://fabi-pc.taildd1460.ts.net:7480'
const TINT = { emergency: 'bad', attention: 'warn', info: 'neutral' }

export default {
  refresh: '15m',
  every: 300,
  async run() {
    const tv = await getJson(`${BASE}/api/tv`)
    const alerts = (tv.alerts ?? []).filter((a) => !a.until || Date.parse(a.until) > Date.now())
    const worst = alerts.find((a) => a.level === 'emergency') ?? alerts.find((a) => a.level === 'attention') ?? alerts[0]

    return {
      id: 'tv-alerts',
      app: 'Lucid TV',
      title: 'Alerts',
      symbol: 'exclamationmark.triangle.fill',
      kind: 'list',
      tint: worst ? TINT[worst.level] ?? 'warn' : 'ok',
      value: String(alerts.length),
      label: alerts.length === 1 ? 'alert' : 'alerts',
      caption: worst ? String(worst.title) : 'all quiet',
      items: alerts.slice(0, 4).map((a) => ({
        title: String(a.title), detail: ago(a.last ?? a.at), tag: a.source || undefined, tint: TINT[a.level],
        action: /^[A-Za-z0-9._~-]{1,80}$/.test(String(a.id)) ? `ack:${a.id}` : undefined, symbol: 'checkmark',
      })),
      url: UI,
      staleAfter: 1800,
      order: 80,
    }
  },
  async act({ name, arg }) {
    if (name !== 'ack') throw new Error(`unknown action ${name}`)
    const r = await getJson(`${BASE}/api/alert/ack`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: arg }) })
    if (!r.ok) throw new Error('already gone')
    return { message: 'Cleared' }
  },
}
