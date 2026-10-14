// Shared fetch for feeds. Underscore prefix: the hub does not load this as a feed.
export async function getJson(url, init = {}) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(init.timeoutMs ?? 15000) })
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${url} -> HTTP ${res.status}`)
  return res.json()
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function ago(iso, now = Date.now()) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (s < 90) return 'just now'
  if (s < 5400) return `${Math.round(s / 60)}m ago`
  if (s < 129600) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}
