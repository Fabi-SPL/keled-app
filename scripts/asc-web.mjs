#!/usr/bin/env node
// The one App Store Connect step Apple's API refuses: creating an app record.
// POST /v1/apps answers 403 "does not allow CREATE" for every key role (re-measured
// 2026-10-16 with an Account Holder + Admin key). The website itself creates apps through
// /iris/v1/apps, so this calls that endpoint inside Fabi's own signed-in Brave, through the
// shared Lucid browser proxy (localhost:9234). No Apple password or cookie is ever read,
// stored or printed here, and the only write it can make is POST /iris/v1/apps: never
// agreements, tax, banking or users.
//
//   node scripts/asc-web.mjs status                        signed in or not (exit 0 / 4)
//   node scripts/asc-web.mjs wait-login [minutes]          open the sign-in page, wait for him
//   node scripts/asc-web.mjs create <bundleId> <Name> <sku>
//
// Most sessions never call this directly: `asc.mjs app-new` uses it when he is signed in and
// falls back to a spare record when he is not.

import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const PROXY = process.env.LUCID_BROWSER_URL || 'http://localhost:9234/mcp'
const ASC = 'https://appstoreconnect.apple.com'

let sid
let seq = 0
async function rpc(method, params, notify = false) {
  const msg = { jsonrpc: '2.0', method, params }
  if (!notify) msg.id = ++seq
  let res
  try {
    res = await fetch(PROXY, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...(sid ? { 'mcp-session-id': sid } : {}),
      },
      body: JSON.stringify(msg),
    })
  } catch {
    throw new Error(`browser proxy not reachable at ${PROXY}; run: node C:/Programs/Claude/lucid-hq2/scripts/lucid-browser.mjs up`)
  }
  sid = sid || res.headers.get('mcp-session-id')
  if (notify) return null
  const text = await res.text()
  if (!res.ok) throw new Error(`browser proxy ${res.status}: ${text.slice(0, 200)}`)
  let reply
  if ((res.headers.get('content-type') || '').includes('event-stream')) {
    for (const line of text.split('\n')) {
      if (!line.startsWith('data:')) continue
      const m = JSON.parse(line.slice(5))
      if (m.id === msg.id) reply = m
    }
  } else reply = JSON.parse(text)
  if (!reply) throw new Error(`browser proxy gave no answer to ${method}`)
  if (reply.error) throw new Error(reply.error.message)
  return reply.result
}

async function open() {
  sid = undefined
  await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'asc-web', version: '1' } })
  await rpc('notifications/initialized', {}, true)
}

async function close() {
  if (!sid) return
  await fetch(PROXY, { method: 'DELETE', headers: { 'mcp-session-id': sid } }).catch(() => {})
  sid = undefined
}

async function tool(name, args) {
  const r = await rpc('tools/call', { name, arguments: args })
  const text = (r.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n')
  if (r.isError) throw new Error(text.slice(0, 400))
  return text
}

// browser_evaluate takes no arguments, so values go in as JSON literals.
async function evaluate(fn) {
  const text = await tool('browser_evaluate', { function: fn })
  const m = text.match(/### Result\n([\s\S]*?)(\n### |$)/)
  return JSON.parse(m ? m[1] : 'null')
}

const ON_ASC = `location.origin === ${JSON.stringify(ASC)}`
const PROBE = `async () => {
  if (!(${ON_ASC})) return 0
  const r = await fetch('/iris/v1/apps?limit=1&fields[apps]=bundleId', { credentials: 'include', headers: { accept: 'application/json' } })
  return r.status
}`

async function signedIn() {
  await tool('browser_navigate', { url: `${ASC}/apps` })
  return (await evaluate(PROBE)) === 200
}

function body(bundleId, name, sku) {
  const locale = 'en-US'
  return {
    data: {
      type: 'apps',
      attributes: { sku, primaryLocale: locale, bundleId },
      relationships: {
        appStoreVersions: { data: [{ type: 'appStoreVersions', id: '${store-version-IOS}' }] },
        appInfos: { data: [{ type: 'appInfos', id: '${new-appInfo-id}' }] },
      },
    },
    included: [
      {
        type: 'appInfos',
        id: '${new-appInfo-id}',
        relationships: { appInfoLocalizations: { data: [{ type: 'appInfoLocalizations', id: '${new-appInfoLocalization-id}' }] } },
      },
      { type: 'appInfoLocalizations', id: '${new-appInfoLocalization-id}', attributes: { locale, name } },
      {
        type: 'appStoreVersions',
        id: '${store-version-IOS}',
        attributes: { platform: 'IOS', versionString: '1.0' },
        relationships: { appStoreVersionLocalizations: { data: [{ type: 'appStoreVersionLocalizations', id: '${new-IOSVersionLocalization-id}' }] } },
      },
      { type: 'appStoreVersionLocalizations', id: '${new-IOSVersionLocalization-id}', attributes: { locale } },
    ],
  }
}

// Returns { id, name } of the new record. A taken name (App Store names are global)
// retries once as "<Name> Fabi", the pattern Health and Ride already use.
export async function createApp(bundleId, name, sku) {
  await open()
  try {
    if (!(await signedIn())) {
      const e = new Error('not signed in to App Store Connect in Brave')
      e.code = 'SIGNED_OUT'
      throw e
    }
    for (const tryName of [name, `${name} Fabi`]) {
      const r = await evaluate(`async () => {
        const r = await fetch('/iris/v1/apps', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json', accept: 'application/json', 'x-csrf-itc': '[asc-ui]' },
          body: ${JSON.stringify(JSON.stringify(body(bundleId, tryName, sku)))},
        })
        const text = await r.text()
        let id = null
        try { id = JSON.parse(text).data.id } catch {}
        return { status: r.status, id, text: id ? '' : text.slice(0, 1500) }
      }`)
      if ((r.status === 201 || r.status === 200) && r.id) return { id: r.id, name: tryName }
      const taken = r.status === 409 && /name/i.test(r.text) && /(use|taken|already)/i.test(r.text)
      if (!taken) throw new Error(`create ${bundleId} failed: ${r.status} ${r.text.slice(0, 600)}`)
      console.error(`name "${tryName}" is taken on the App Store, trying the next one`)
    }
    throw new Error(`every name for ${bundleId} was taken`)
  } finally {
    await close()
  }
}

export async function isSignedIn() {
  await open()
  try { return await signedIn() } finally { await close() }
}

// Opens the sign-in page in his Brave and keeps the tab alive until the session works.
async function waitLogin(minutes) {
  await open()
  try {
    await tool('browser_navigate', { url: `${ASC}/login?targetUrl=%2Fapps` })
    const until = Date.now() + minutes * 60_000
    while (Date.now() < until) {
      let status = 0
      try {
        status = await evaluate(`async () => {
          for (let i = 0; i < 10; i++) {
            const r = await fetch('/iris/v1/apps?limit=1&fields[apps]=bundleId', { credentials: 'include' })
            if (r.status === 200) return 200
            await new Promise((ok) => setTimeout(ok, 5000))
          }
          return 401
        }`)
      } catch {
        // Signing in navigates the page and kills the running script; just ask again.
      }
      if (status === 200) return true
    }
    return false
  } finally {
    await close()
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [cmd, ...a] = process.argv.slice(2)
  try {
    if (cmd === 'status') {
      const ok = await isSignedIn()
      console.log(ok ? 'signed in' : 'signed out')
      process.exit(ok ? 0 : 4)
    } else if (cmd === 'wait-login') {
      const ok = await waitLogin(Number(a[0] || 20))
      console.log(ok ? 'signed in' : 'still signed out')
      process.exit(ok ? 0 : 4)
    } else if (cmd === 'create' && a.length === 3) {
      const r = await createApp(a[0], a[1], a[2])
      console.log(`created ${r.id} ${a[0]} "${r.name}"`)
    } else {
      console.error('usage: asc-web.mjs status | wait-login [minutes] | create <bundleId> <Name> <sku>')
      process.exit(2)
    }
  } catch (e) {
    console.error(e.message)
    process.exit(e.code === 'SIGNED_OUT' ? 4 : 1)
  }
}
