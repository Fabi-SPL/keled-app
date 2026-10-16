// Vesta family calendar on the Hetzner box. Read with the cal agent token the vesta CLI
// already uses (~/.claude/vesta-agent.json); GET /api/occurrences is the only call.
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getJson } from './_http.mjs'

const CFG = process.env.KELED_VESTA_AGENT || join(homedir(), '.claude', 'vesta-agent.json')
const BASE = process.env.KELED_VESTA_URL || 'https://hetzner-lucid.taildd1460.ts.net:7443'
const DAY = 86400000

const clock = (ms) => new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

export default {
  refresh: '30m',
  every: 900,
  async run() {
    const { token } = JSON.parse(readFileSync(CFG, 'utf8'))
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const today = start.getTime()
    const { occurrences = [] } = await getJson(`${BASE}/api/occurrences?from=${today}&to=${today + 2 * DAY}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    const now = Date.now()
    const ahead = occurrences.filter((o) => o.end > now).sort((a, b) => a.start - b.start)
    const todays = ahead.filter((o) => o.start < today + DAY)
    const nextTimed = todays.find((o) => !o.allDay)
    const when = (o) => {
      const day = o.start < today + DAY ? 'today' : 'tomorrow'
      return o.allDay ? day : day === 'today' ? clock(o.start) : `tmrw ${clock(o.start)}`
    }

    return {
      id: 'vesta',
      app: 'Vesta',
      title: 'Calendar',
      symbol: 'calendar',
      kind: 'list',
      tint: todays.length ? 'accent' : 'ok',
      value: String(todays.length),
      label: 'today',
      caption: nextTimed ? `next ${clock(nextTimed.start)} ${nextTimed.title}` : todays.length ? 'all-day only' : 'nothing today',
      items: ahead.slice(0, 4).map((o) => ({ title: String(o.title || 'Event'), detail: when(o), tag: o.calendar })),
      data: ahead[0]
        ? { nextAt: new Date(ahead[0].start).toISOString(), next: String(ahead[0].title || 'Event').replace(/\s+-\s+/g, ' – '), nextAllDay: ahead[0].allDay ? '1' : '', today: String(todays.length) }
        : { today: '0' },
      url: BASE,
      staleAfter: 3600,
      order: 40,
    }
  },
}
