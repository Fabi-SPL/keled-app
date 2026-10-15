// Cura, the Lucid chat and mind UI on this PC. /api/chat?limit=1 is its small read;
// /api/state is 88 KB and stays out of a widget.
import { getJson } from './_http.mjs'

const BASE = process.env.KELED_CURA_URL || 'http://127.0.0.1:4611'
const UI = 'https://fabi-pc.taildd1460.ts.net:4443'

const short = (iso) => {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000))
  return s < 90 ? 'now' : s < 5400 ? `${Math.round(s / 60)}m` : s < 129600 ? `${Math.round(s / 3600)}h` : `${Math.round(s / 86400)}d`
}

export default {
  refresh: '15m',
  every: 300,
  async run() {
    const chat = await getJson(`${BASE}/api/chat?limit=1`)
    const last = chat.messages?.at(-1)
    const hers = last?.from === 'lucid'

    return {
      id: 'cura',
      app: 'Cura',
      title: 'Lucid',
      symbol: 'bubble.left.fill',
      kind: 'status',
      tint: chat.busy ? 'accent' : hers ? 'warn' : 'neutral',
      value: chat.busy ? 'Typing' : last ? short(last.at) : '–',
      label: chat.busy ? 'replying' : hers ? 'she wrote' : 'you wrote last',
      caption: last ? String(last.text) : 'no messages yet',
      url: UI,
      staleAfter: 1800,
      order: 50,
    }
  },
}
