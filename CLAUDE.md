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
- `url` is where a tap goes: the web app. `--stale <sec>` greys the card once it is older than that.
- Lock screen sizes show `value` + `label` + one line. Keep `value` to 4-5 characters for the circular one.
- Item titles and captions are hidden on a locked device (privacySensitive); numbers stay visible.
- Minimal data only: counts, names, short subjects. Never mail bodies or anything you would not
  want on a lock screen.

## Keep a card fresh automatically (a feed)

A card that has to track live state gets a feed: `hub/feeds/<name>.mjs`, default export
`{ every: seconds, run(): card | card[] }`. See `feeds/office.mjs`. Feeds load when the hub starts:

```powershell
node hub/widget.mjs feed <name>      # dry run, prints the cards it would write
Get-CimInstance Win32_Process -Filter "name='node.exe'" | ? CommandLine -like '*keled-app*server.mjs*' | % { Stop-Process -Id $_.ProcessId }
# run-hub.vbs restarts it 5 s later (scheduled task KeledWidgetHub, hidden)
```

## Build and ship

- No Mac. GitHub Actions compiles everything (`.github/workflows/`).
- `ios-check.yml`: simulator build of app + widget extension, screenshots of every widget size
  on iPhone and iPad (artifact `keled-screens`). This is the compiler; read it before claiming
  any Swift change works.
- `testflight.yml`: signed archive to TestFlight on push to main, by hand, and on the 1st of every
  month (builds expire after 90 days and take every widget with them).
- `ios/project.yml` is XcodeGen; the `.xcodeproj` is generated in CI and never committed.
- The hub URL and token reach the app only through repo secrets (`KELED_HUB_URL`,
  `KELED_HUB_TOKEN`). The repo is public: never commit either, never upload the IPA.
- Swift changes only for a new card *kind* or a new layout. Add the kind in `hub/store.mjs`
  (KINDS) and in `ios/Shared/CardViews.swift` in the same commit.

## Hub tests

`npm test` (node --test). `npm run typecheck`.
