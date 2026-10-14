// Lucid TV on this PC, alerts only: its weather, HQ and mail tiles already have their own
// card or an iOS widget. Anything on the PC can raise a TV alert, so this is the alarm card.
import { getJson, ago } from './_http.mjs'

const BASE = process.env.KELED_TV_URL || 'http://127.0.0.1:7480'
const UI = 'https://fabi-pc.taildd1460.ts.net:7480'
const TINT = { emergency: 'bad', attention: 'warn', info: 'neutral' }

export default {
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
      items: alerts.slice(0, 4).map((a) => ({ title: String(a.title), detail: ago(a.last ?? a.at), tag: a.source || undefined, tint: TINT[a.level] })),
      url: UI,
      staleAfter: 1800,
      order: 80,
    }
  },
}
