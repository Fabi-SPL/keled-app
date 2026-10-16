// Makes sure Keled has what Health and Ride already have: an internal TestFlight group "Auto"
// that gets every build, with Fabi in it, so a new build reaches his phone without a click.
// Internal groups need no Beta App Review. The tester is copied from the Health app's group,
// so no address sits in this public repo, and nothing here prints one into the public logs.
//
//   node scripts/tester-group.mjs <keledAppId> [--dry]
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ASC = fileURLToPath(new URL('./asc.mjs', import.meta.url))
const [appId, flag] = process.argv.slice(2)
const dry = flag === '--dry'
if (!appId) { console.error('usage: tester-group.mjs <appId> [--dry]'); process.exit(2) }

const asc = (method, path, body) => {
  const args = [ASC, 'raw', method, path]
  if (body) args.push(JSON.stringify(body))
  const out = execFileSync(process.execPath, args, { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } })
  return out.trim() ? JSON.parse(out) : {}
}
const write = (method, path, body, what) => {
  if (dry) { console.log(`dry: would ${what}`); return { data: { id: 'dry' } } }
  return asc(method, path, body)
}
const groupsOf = (app) => asc('GET', `/v1/apps/${app}/betaGroups?fields[betaGroups]=name,isInternalGroup,hasAccessToAllBuilds&limit=50`).data
const testersOf = (group) => asc('GET', `/v1/betaGroups/${group}/betaTesters?fields[betaTesters]=email,firstName,lastName&limit=50`).data

let group = groupsOf(appId).find((g) => g.attributes.isInternalGroup && g.attributes.hasAccessToAllBuilds)
if (group) console.log(`group "${group.attributes.name}" already gets every build`)
else {
  group = write('POST', '/v1/betaGroups', {
    data: {
      type: 'betaGroups',
      attributes: { name: 'Auto', isInternalGroup: true, hasAccessToAllBuilds: true },
      relationships: { app: { data: { type: 'apps', id: appId } } },
    },
  }, 'create internal group "Auto" with every build').data
  console.log('created internal group "Auto"')
}

const have = group.id === 'dry' ? [] : testersOf(group.id)
if (have.length) { console.log(`${have.length} tester(s) already in it`); process.exit(0) }

const health = asc('GET', '/v1/apps?filter[bundleId]=com.fabi.lucidhealth&fields[apps]=bundleId').data[0]
const source = health && groupsOf(health.id).find((g) => g.attributes.isInternalGroup)
const testers = source ? testersOf(source.id) : []
if (!testers.length) {
  console.log('::warning::No tester to copy. Add yourself once: TestFlight -> Internal Testing -> Auto -> +')
  process.exit(0)
}
// Tester records are per app: linking Health's tester id into another app's group answers
// 409 "Tester(s) cannot be assigned" (measured 2026-10-16 on Keled). Creating the tester
// again from the same address, straight into this group, is what works.
for (const t of testers) {
  const { email, firstName, lastName } = t.attributes
  write('POST', '/v1/betaTesters', {
    data: {
      type: 'betaTesters',
      attributes: { email, firstName, lastName },
      relationships: { betaGroups: { data: [{ type: 'betaGroups', id: group.id }] } },
    },
  }, 'add a tester from the Health app\'s group')
}
console.log(`added ${testers.length} tester(s) from the Health app's group`)
