// Lucid's neural network: how many memories (nodes) it holds right now and how fast it grows.
// Reads Supabase over the tailnet with the same service key nn-zoom uses, read-only counts.
import { readFileSync } from 'node:fs'

const BASE = process.env.KELED_NN_URL || 'https://db.speed-running-life.com'
const MCP = process.env.KELED_NN_MCP || 'C:/Programs/Claude/ee-personal-app/.mcp.json'
const USER = '372210e5-1dda-41b3-b759-5ff72293b8ff'
const UI = 'https://fabi-pc.taildd1460.ts.net'

let jwt = null
function serviceKey() {
  if (jwt) return jwt
  const find = (o) => {
    for (const v of Object.values(o ?? {})) {
      if (typeof v === 'string' && v.split('.').length === 3) {
        try { if (JSON.parse(Buffer.from(v.split('.')[1], 'base64').toString()).role === 'service_role') return v } catch {}
      } else if (v && typeof v === 'object') { const r = find(v); if (r) return r }
    }
    return null
  }
  jwt = find(JSON.parse(readFileSync(MCP, 'utf8')))
  if (!jwt) throw new Error('no service key in ' + MCP)
  return jwt
}

async function pg(query) {
  const key = serviceKey()
  const res = await fetch(`${BASE}/pg/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`pg ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

const fmt = (n) => n.toLocaleString('en-US')

export default {
  every: 60,
  refresh: '5m',
  async run() {
    const [row] = await pg(`select count(*)::int total,
        count(*) filter (where created_at > now() - interval '1 hour')::int last_hour,
        count(*) filter (where created_at >= (date_trunc('day', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin'))::int today_n,
        count(*) filter (where raptor_level = 0)::int atoms,
        count(*) filter (where raptor_level > 0)::int branches
      from knowledge_entries where user_id = '${USER}'`)
    const hours = await pg(`select floor(extract(epoch from (now() - created_at)) / 3600)::int h, count(*)::int n
      from knowledge_entries where user_id = '${USER}' and created_at > now() - interval '24 hours' group by 1`)
    const perHour = Array.from({ length: 24 }, (_, i) => hours.find((r) => r.h === 23 - i)?.n ?? 0)

    return {
      id: 'neural',
      app: 'Lucid',
      title: 'Neural network',
      symbol: 'brain',
      kind: 'spark',
      tint: row.last_hour > 0 ? 'ok' : 'accent',
      value: fmt(row.total),
      label: 'nodes',
      caption: `+${fmt(row.last_hour)} last hour · +${fmt(row.today_n)} today`,
      series: perHour,
      items: [
        { title: 'Memories', detail: fmt(row.atoms) },
        { title: 'Branches', detail: fmt(row.branches) },
        { title: 'Last hour', detail: `+${fmt(row.last_hour)}` },
        { title: 'Today', detail: `+${fmt(row.today_n)}` },
      ],
      data: { total: String(row.total), hour: String(row.last_hour), today: String(row.today_n) },
      url: UI,
      staleAfter: 900,
      order: 2,
    }
  },
}
