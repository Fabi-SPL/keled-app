# Keled app: one iPhone/iPad app that hosts widgets for every web app

The web apps stay web apps. This repo is the only native code: a thin SwiftUI app plus a
WidgetKit extension that draws **cards** from a card hub on Fabi's PC. A card is data, not
code, so putting a new widget on his phone never needs an Xcode change or a new build.

```
session / feed ──> hub/data/cards/*.json ─> hub (PC :7840, tailnet only, Bearer token)
                                                   │  https://fabi-pc.taildd1460.ts.net:7840/v1/cards
                                                   ▼
                              Keled app + widget extension (iPhone, iPad, via Tailscale)
```

## Put something on his widgets (the common case)

```bash
node C:/Programs/Claude/keled-app/hub/widget.mjs schema            # every field, limits
node C:/Programs/Claude/keled-app/hub/widget.mjs put deploys --app "Keled Site" --title Deploys \
     --symbol hammer.fill --value 3 --label today --tint ok --url https://... --stale 7200
node C:/Programs/Claude/keled-app/hub/widget.mjs put inbox --kind list \
     --item "Lena|draft ready|2|warn" --item "Mira|idle"
node C:/Programs/Claude/keled-app/hub/widget.mjs list | rm <id> | doctor
```

- The card shows up in the widget editor's "Choose a card" list on the next refresh. No build.
- `kind`: metric (big number), list (rows), gauge (ring, `progress` 0..1), status (dot + word), spark (`series`).
- `tint` means status: ok / warn / bad / neutral; accent is the wine splash. Never colour for decoration.
- `url` is where a tap goes: the web app, opened full screen **inside Keled** (see "Where a tap
  goes"). `--open safari` sends it to Safari instead. `--stale <sec>` greys the card once it is older than that.
- A card needs no app behind it: a tax deadline, a countdown, a number a script computes. `taxes-ustva`
  is the worked example (app-less, own layouts, ticking day count, ELSTER link in Safari).
- Lock screen sizes show `value` + `label` + one line. Keep `value` to 4-5 characters for the circular one.
- Item titles and captions are hidden on a locked device (privacySensitive); numbers stay visible.
- Minimal data only: counts, names, short subjects. Never mail bodies or anything you would not
  want on a lock screen.

## Keep a card fresh automatically (a feed)

A card that has to track live state gets a feed: `hub/feeds/<name>.mjs`, default export
`{ every: seconds, refresh: '5m', run(): card | card[] }`. See `feeds/office.mjs`. Feeds load when the hub starts.

Two clocks, both per feed. `every` is how often the hub polls the source (keep it at or under
`refresh`). `refresh` is how often the phone asks again: seconds or `5m` / `30m` / `1h`, also
settable per card (`--refresh`), card wins. Pick it by how fast the thing changes: a live
counter 5m, mail 10m, a bank balance or a calendar 30m. iOS sets the real limits (Apple,
"Keeping a widget up to date"): each widget has its own budget of about 40-70 reloads a day and
is not reloaded sooner than about 5 minutes, so 5m is the floor and the hub clamps to it. Opening
Keled and tapping a widget button reload everything outside that budget. `widget.mjs reloads`
shows how often the phone really fetched, per widget, from the hub's log.

```powershell
node hub/widget.mjs feed <name>      # dry run, prints the cards it would write
Get-NetTCPConnection -LocalPort 7840 -State Listen | ? LocalAddress -eq '127.0.0.1' | % { Stop-Process -Id $_.OwningProcess }
# run-hub.vbs restarts it 5 s later (scheduled task KeledWidgetHub, hidden)
```

Live feeds (one card each unless noted):

| Feed | Source | Card |
|---|---|---|
| lucid | Companion app :5274, cookie from its .env | habits done today, focus |
| hq | Lucid HQ :4612 | unread sessions, running |
| mail | Keled Mail on Hetzner | need-you count, marked for Claude (2 cards) |
| office | Keled Office :4640 | run state, asks (2 cards) |
| olympus | Olympus :7830 | last meeting, motions held for him |
| vesta | Vesta calendar on Hetzner, cal agent token | events today and tomorrow |
| cura | Cura :4611 | last message from Lucid |
| argus | Argus on Hetzner | network posture checks |
| tv | Lucid TV :7480 | open alerts only, tick clears one |
| neural | Supabase knowledge_entries (tailnet) | node count, +last hour, +today, 24 h spark |

Paces: neural, office, hq 5m · mail 10m · lucid, cura, tv 15m · olympus, vesta, argus 30m.

## Give an app its own look (themes and free layouts, no build)

Every web app is designed differently, so its widgets can be too. Two layers, both data:

- **Theme** = colours, fonts, background for every card of one app. `hub/themes/<name>.json`,
  picked by the card's `theme` field or automatically by its `app` name slugged (`Keled Mail` ->
  `keled-mail`). Light and `dark` colours, `font`/`numbers` system|rounded|serif|mono, `bg` one hex or
  a gradient, `image` an asset. `node hub/widget.mjs theme put keled-mail --file t.json`.
- **Layout** = a node tree drawn natively per widget size: vstack, hstack, zstack, text, symbol,
  image, ring, bar, spark, date (counts days or ticks live), button, check, link, each (per item).
  On a card (`--layout small=s.json`) or in a theme keyed `<family>`, `<kind>.<family>` or
  `<cardId>.<family>`. Families: small medium large xl circular rectangular inline.
  `node hub/widget.mjs schema` lists every node field and template.

```json
{ "type": "vstack", "align": "leading", "maxW": true, "maxH": true, "frameAlign": "topLeading", "children": [
  { "type": "text", "text": "{title}", "size": 11, "weight": "semibold", "color": "muted", "upper": true },
  { "type": "spacer" },
  { "type": "text", "text": "{value}", "size": 44, "weight": "bold", "design": "numbers", "color": "accent" },
  { "type": "text", "text": "{label}", "size": 13 } ] }
```

- No layout for a size -> the built-in look, dressed in the theme. A bad field is refused at `put`, so a
  typo never reaches the phone; an unknown node on the phone draws nothing, never a crash.
- The lock screen (circular, rectangular, inline) and tinted home screens are drawn by iOS in one
  colour: themes keep only their fonts there. Design those sizes for one colour.
- Designing an app's look is Minerva's job, from that app's own CSS. Ad-hoc sessions put data and
  maybe a layout, not a palette they invented.

## Buttons on a widget (actions)

Widgets can only run code compiled into the app, so there is one compiled button and the hub
decides what it does. The phone sends `{card, action, on}`; nothing else.

```bash
# a put card: the handler lives on this PC, the phone never sees it
node hub/widget.mjs put lamp --title Lamp --kind status --value Off \
  --action "power|Toggle|power|filled" \
  --do 'power={"http":{"method":"POST","url":"http://127.0.0.1:9999/lamp","body":{"on":"{on}"}},"then":"toggle"}'
# rows: --item "Washer done|4m ago||warn|ack:a1" makes a tick on that row
node hub/widget.mjs act lamp power          # fire it exactly like a tap, from here
```

- Ref = `name` or `name:arg` (arg `[A-Za-z0-9._~-]`, never `.`, `..` or a leading `-`, so it cannot
  change the shape of a URL path, body or argv).
  `{arg}` `{on}` `{card}` fill into the handler. Only refs the card shows can be fired.
- Handler: `{"http": {...}}` or `{"run": [argv], "cwd": ...}`, plus `confirm` (second tap within 10 s,
  Face ID on a locked phone) and `then` toggle|remove|none (what the card shows after).
- `do` can only be set from the CLI or a feed on this PC. GET never serves it. Over HTTP a `PUT` cannot
  touch a card that has handlers or belongs to a feed (409), and `source` is always `push`.
- Confirm is decided on the PC (handler `confirm`, feed `confirm`, action `confirm`) and the hub
  copies it onto every button and row it applies to; the phone guards exactly those.
- Limits: 150 cards, 32 KB per card, 64 KB per request (413).
- Feeds: export `act({card, name, arg, on})` and optional `confirm: ['name']`; the feed re-runs after.
  `feeds/tv.mjs` is the example: each TV alert row has a tick that clears it on the TV.
- After a tap the card shows `Done` (or the handler's `message`) for 30 s, a failure for 2 min.
  Every tap is logged to `hub/data/actions.log`.
- An action with `url` instead of a handler only opens something.

## Where a tap goes

iOS gives a widget no way to open an installed home-screen web app: every https link lands in
Safari, whatever the manifest says. So a tap opens `keled://open?url=...` and Keled shows the web
app full screen in a kept-alive web view (`ios/Keled/WebHost.swift`): coming back resumes, links to
other sites go to Safari, the mic works without a prompt only on his own tailnet
(`*.taildd1460.ts.net`), and the top bar shows the real host for anything else. Logins are Keled's own (separate
from the PWA), so he logs in once per app inside Keled. Push notifications stay with the PWAs.

## Look before it ships (preview)

```bash
node hub/widget.mjs preview taxes-ustva mail          # stored cards
node hub/widget.mjs preview --file my-cards.json      # cards not stored yet
```

Dispatches `ios-check.yml` with the cards, waits (~8 min), downloads light and dark screenshots of
small, medium, large and the lock screen sizes to `shots/preview/<tag>/`. Open every PNG before
calling a design done.

The CI repo is public, so the cards cross GitHub sealed (AES-256-GCM, `hub/seal.mjs`, key in
`C:/Programs/Claude/.secrets/keled-preview.key` and the `KELED_PREVIEW_KEY` secret). The runner
shoots them into a folder it never uploads and seals each PNG; the CLI opens them here. Never send
real cards to CI any other way.

## Build and ship

- No Mac. GitHub Actions compiles everything (`.github/workflows/`).
- `ios-check.yml`: simulator build of app + widget extension, screenshots of every widget size
  on iPhone and iPad (artifact `keled-screens`). This is the compiler; read it before claiming
  any Swift change works.
- `testflight.yml`: signed archive to TestFlight on push to main, by hand, and on the 1st of every
  month (builds expire after 90 days and take every widget with them). Run it by hand with
  `-f upload=false` to prove signing without uploading.
- Signing: one Apple Distribution certificate (key and p12 in `C:/Programs/Claude/.secrets/apple-dist`,
  repo secrets `DIST_P12_BASE64` / `DIST_P12_PASSWORD` / `DIST_CERT_ID`, expires 2027-10-15) and an
  App Store profile per bundle that `scripts/asc.mjs profile` reuses or replaces. CI never creates or
  revokes a certificate: every revoke mails Fabi "Your certificate has been revoked". Never bring back
  `-allowProvisioningUpdates` or a prune step.
- `ios/project.yml` is XcodeGen; the `.xcodeproj` is generated in CI and never committed.
- The hub URL and token reach the app only through repo secrets (`KELED_HUB_URL`,
  `KELED_HUB_TOKEN`). The repo is public: never commit either, never upload the IPA.
- Swift changes only for a new card *kind* or a new layout *node type*. Add it in `hub/store.mjs`
  (KINDS or NODE_TYPES) and in `ios/Shared/CardViews.swift` / `LayoutRenderer.swift` in the same commit.
  Anything that needs a new intent, widget family or entitlement needs a TestFlight build; everything
  else in this file is data.
- Keled's App Store Connect record is app 6823607428 (made 2026-10-16). Fabi is in its internal
  "Auto" group, which gets every build with no review.

## A new iOS app, for any session (never ask Fabi)

`node scripts/asc.mjs app-new com.fabi.<thing> "<Name>"` makes the App Store Connect record, the
one step Apple's API refuses (POST /v1/apps is 403 for every key role). Two routes, in order:
his signed-in Brave through the shared browser proxy (`scripts/asc-web.mjs`, the website's own
endpoint, only ever POST /iris/v1/apps), else one of the spare records "Fabi Spare N", renamed and
re-pointed at the new bundle ID over the API. `asc.mjs spares` shows how many are left; a run while
he is signed in tops them back up to 5. It is idempotent and locked, a taken name falls back to
"<Name> Fabi", and a bundle ID that sat on a record can never move to another one.

Then: `bundle-create` / `cap-enable` for the widget extension and App Group, a `testflight.yml`
copied from this repo, and `tester-group.mjs <appId>` (the workflow runs it after upload), so Fabi
gets the app with no click beyond the one TestFlight invite mail per app. Automation never opens
Agreements, Tax, Banking or Users: if Apple posts a new agreement, uploads fail until Fabi accepts
it himself, and the session tells him so.

## Hub tests

`npm test` (node --test). `npm run typecheck`.
