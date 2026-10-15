// Every card fetch the phone makes, so how often iOS really reloads each widget is a number,
// not a guess. The phone names itself in X-Keled-Source: "app", "widget:<card>", "board:<app>".
import { appendFileSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DATA_DIR } from './store.mjs'

const FILE = () => join(DATA_DIR, 'fetches.jsonl')
const KEEP = 20000
let writes = 0

export function logFetch(source, now = Date.now()) {
  const src = /^[A-Za-z0-9:._-]{1,64}$/.test(String(source ?? '')) ? String(source) : 'unknown'
  try {
    mkdirSync(DATA_DIR, { recursive: true })
    appendFileSync(FILE(), JSON.stringify({ t: now, src }) + '\n')
    // Trim only now and then, so a busy day never re-reads the whole file per request.
    if (++writes % 500 === 0) {
      const lines = readFileSync(FILE(), 'utf8').trim().split('\n')
      if (lines.length > KEEP) writeFileSync(FILE(), lines.slice(-KEEP).join('\n') + '\n')
    }
  } catch { /* measuring must never break serving */ }
}

// Per source over the last `hours`: fetch count, median and shortest gap in minutes, last seen.
export function reloadStats(hours = 24, now = Date.now()) {
  if (!existsSync(FILE())) return []
  const since = now - hours * 3600_000
  const by = new Map()
  for (const line of readFileSync(FILE(), 'utf8').split('\n')) {
    if (!line) continue
    let e
    try { e = JSON.parse(line) } catch { continue }
    if (e.t < since) continue
    if (!by.has(e.src)) by.set(e.src, [])
    by.get(e.src).push(e.t)
  }
  const out = []
  for (const [src, ts] of by) {
    ts.sort((a, b) => a - b)
    const gaps = ts.slice(1).map((t, i) => (t - ts[i]) / 60000).sort((a, b) => a - b)
    const median = gaps.length ? gaps[Math.floor(gaps.length / 2)] : null
    out.push({ src, count: ts.length, medianMin: median, minMin: gaps[0] ?? null, last: new Date(ts[ts.length - 1]).toISOString() })
  }
  return out.sort((a, b) => b.count - a.count)
}
