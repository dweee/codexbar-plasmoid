# macOS usage parity

Version: **0.7.0-dave.1**. Reference: read-only `upstream/main` of CodexBar,
not the older 0.74 checkout. The Linux CLI contract is CodexBar 0.83.0.

## Feature map

Source paths below are relative to upstream `Sources/CodexBar/`, except Core.

| macOS source | Widget implementation | Behavior |
| --- | --- | --- |
| `Core/UsagePace.swift`, `UsagePaceText.swift` | `contents/ui/code/pace.js`, `ProviderCard.qml`, `UsageBar.qml` | Structured primary/secondary/tertiary pace; session wording; stage-colored expected marker; Codex headroom; optional risk; calendar workday fallback. Show pace defaults on. |
| `SessionEquivalentForecast.swift` | `code/sessionEquivalent.js`, `code/parity.js` | Latest seven completed active groups, exact-time weekly pairing, three-burn minimum, median full-session weekly consumption, reset-correction segments, idle sessions, fractional estimates and integer windows. |
| `PlanUtilizationHistoryStore.swift`, `UsageStore/UsageStore+PlanUtilization.swift` | `code/history.js`, `ParityStore.qml` | Paired local observations, hourly peaks, reset-edge preservation; at most 17,520 entries per series and 64 provider/account database rows. |
| `UsageStore/UsageStore+LimitResetCelebration.swift`, `UsageStore+LimitResetBoundary.swift` | `code/resetDetector.js` | One-percent crossing, session boundary tolerance, Claude confirmation/recovery, Codex five-percent advance and delayed 25-to-five-percent candidates, Grok rollover guard, source/plan changes, stale captures. |
| `LimitResetNotifications.swift` | `code/resetDetector.js`, `code/parity.js` | Persist receipt before emitting; restored notice takes priority over the matching reset notice. Reset notices default off. |
| `ScreenConfettiOverlayController.swift`, provider branding descriptors | `code/confetti.js`, `code/confettiPalettes.js`, `ConfettiCanvas.qml`, `OverlayManager.qml`, `LayerOverlayWindow.qml`, `OverlayWindow.qml` | Six paired phases, four tracers per launch, 42 fragments per tracer; provider palettes; one output-only window per screen; 8.5-second lifetime; reduced-motion guard. Default off. |
| `SessionQuotaNotifications.swift`, `UsageStore/UsageStore+QuotaWarnings.swift` | `code/quotaWarnings.js`, `code/parity.js` | Sanitized descending thresholds, smallest crossed warning, initial low notification and re-arm; independent session/weekly settings; Claude named extras and balance suppression. Defaults off with 50/20 remaining thresholds; lane switches on. |
| `SessionQuotaNotifications.swift` | `code/quotaWarnings.js` | Depleted/restored default on; 0.0001 depleted threshold; trusted Codex boundary and two fresh positive confirmations for ambiguous recovery. |
| `PredictivePaceWarnings.swift` | `code/notificationsMac.js`, `code/parity.js` | Codex/Claude positive-ETA warning, probability gate, per-cycle dedup with native half-window reset correction tolerance, authoritative lasting-to-reset re-arm. Default off. |
| `Providers/Codex/UpcomingResetNotifications.swift` | `code/notificationsMac.js`, `code/parity.js` | Codex weekly unused quota, deepest 24-hour/one-hour stage, persisted boundary receipts. Default off. |
| `UsageStore/UsageStore+CredentialNotifications.swift` | `code/notificationsMac.js`, `main.qml` | Conservative explicit authentication-error episode; fresh non-cache success clears it. Default off. |
| `Providers/Codex/CodexResetCreditExpiryNotifier.swift` | `code/notificationsMac.js`, `ParityStore.qml` | Three-day summary, SHA-256 inventory fingerprints shared across accounts; 192 bounded receipts. As on current upstream, summaries default on with optional credits; additional one-day/one-hour reminders default off. |
| `Settings/PreferencesNotificationsPane.swift` | `configNotifications.qml`, `contents/config/{main.xml,config.qml}` | Independent alert switches, threshold editors, sound on, centered 4.5-second warning card off, Off/Session/Weekly/Both confetti and test requests. |
| `AppNotifications.swift` | Existing `org.kde.notification` transport in `main.qml` | Native KNotification, suppress-sound hint when silent, existing status-change notices preserved. |

`code/` paths in the table are under `contents/ui/`. `Core/` refers to
`Sources/CodexBarCore/`. `code/hash.js` provides platform-independent SHA-256;
`code/parity.js` owns deterministic orchestration, and QML owns persistence and
presentation. `tests/test-parity.js` ports representative upstream cases with
unchanged expected numeric results and copy, including newer correction tests.

## Persistence and account safety

`QtQuick.LocalStorage` opens database **codexbar-plasmoid**. The `parity` table
holds version-local reducers/history; `leases` holds a 45-second owner lease.
A synchronous transaction reads, reduces, reserves receipts and saves before
emitting any desktop notification or celebration. Other widget instances read
the shared state but suppress events while another instance holds the lease.
If the owner closes, a subsequent refresh can take over after lease expiry.
This is at-most-once delivery: a crash after reservation may lose an alert.

Account IDs/emails/account labels, source strings, plan identifiers and credit
receipt material are hashed before persistence. Raw error strings, tokens,
credentials, emails and credit IDs are never written to this database. Unknown
accounts never accumulate forecast history. Distinct identified accounts in a
multi-account CLI response have independent states; ambiguous or duplicate
owners in such a response are skipped. Codex restoration/reset evidence requires
an identified owner. Anonymous Claude uses the native second-low confirmation.

Both history series receive the same capture timestamp from each successful
snapshot (`usage.updatedAt`, or one shared refresh timestamp if missing).
Hourly compaction retains the **union** of the two series' peak capture times,
plus the pre-reset peak, so independently chosen peaks cannot destroy exact
pairing. Source, plan or selected lane identity changes clear the pair history.
Estimates stay hidden until three completed, measurable, aligned burns exist.
They are session-quota equivalents, not conversations or actual session starts.

## Deliberate platform differences and practical limits

- The CLI supplies provider eligibility and structured pace. Widget work days
  affect local fallbacks and forecast capacity; they do **not** change a weekly
  pace already computed by the CLI. Its own configuration remains authoritative.
  Headroom reconstructed for a structured CLI pace uses its linear calendar
  model, rather than silently substituting the widget's work-day selection.
- macOS private credential-owner proofs, strategy continuity and history
  migrations are not serialized. Public identity/source/capture metadata cannot
  establish identical ownership guarantees. The widget does not merge anonymous
  history into a later identified account, and never infers auth expiry from a
  generic provider failure or timeout. Stable opaque CLI owner IDs and a
  classified authentication failure would remove this limitation.
- Native warning lane rules differ from reset/history lanes. The widget resolves
  explicit cadence, Copilot secondary fallback, Antigravity families, Claude
  extras, Cursor shared weekly pools, Amp labels and MiMo/Qoder suppression.
  Provider-private feature/secret gates and owner reconciliation remain native
  app responsibilities. Personal account names are omitted from alert copy.
- Threshold/predictive states persist here to prevent widget restarts from
  repeating alerts; macOS keeps some of these in memory. Retention can eventually
  evict an old account's state. Each instance may have different preferences;
  whichever holds the lease decides whether to emit an event.
- History keeps paired peak-time unions rather than discarding each series'
  non-peak samples independently. Forecasting cannot reconstruct missed/offline
  periods. It does not use token/cost logs as quota history.
- The firework uses a bounded Canvas simulator rather than Vortex. Launch phases,
  particle ceilings, colors, shape dimensions, eight-second fragment lifetime,
  gravity/damping parameters and 8.5-second overlay lifetime are mapped to screen
  pixels/seconds. Rendering is stochastic; it is not a pixel-identical Vortex
  implementation. Three screens can render up to 6,048 fragments concurrently.
- Wayland uses lazy `org.kde.layershell` overlay windows, all-edge anchors,
  exclusion zone -1 and no keyboard interactivity. Missing layer-shell imports
  fall back to ordinary frameless output-only windows. X11 stacking and
  fullscreen behavior depend on the window manager. No live panel is modified.
- Notification delivery, sound and Do Not Disturb remain subject to Plasma's
  notification policy. The sound switch selects the default KNotification sound
  policy or the `suppress-sound` hint, not a bundled macOS Glass sample.
- Settings test buttons queue a request which runs on **Apply**, as explained in
  the page. Requests are ignored at startup, so restarting does not replay them.
- English wording follows upstream. Existing widget localization infrastructure
  does not include translated versions of the new reducer strings yet.

## Validation and manual checks

Run the complete deterministic suite:

```sh
nix shell nixpkgs#nodejs nixpkgs#unzip -c bash tests/run-tests.sh
```

`tests/runtime-parity.qml` is an isolated real-Qt smoke test for LocalStorage,
cross-instance lease/dedup, per-screen windows and timed dismissal. Use a
separate data directory for its temporary database:

```sh
QT_FORCE_STDERR_LOGGING=1 XDG_DATA_HOME=/tmp/codexbar-parity-smoke \
  nix shell nixpkgs#qt6.qtdeclarative nixpkgs#kdePackages.layer-shell-qt \
  -c qml tests/runtime-parity.qml
```

Ensure layer-shell's `lib/qt-6/qml` is on `QML_IMPORT_PATH` (or pass `qml -I`)
when testing that backend. To exercise the plain-window fallback, append
`-- --fallback`; `QT_QPA_PLATFORM=xcb` also tests Xwayland behavior. The harness
captures only its own transparent overlay into
`/tmp/cbp-notes/confetti-overlay.png`; it does not capture the desktop. It never
loads into or controls plasmashell. Remove the chosen temporary data directory
when finished.

The implementation session loaded the real widget and its settings page in
`plasmoidviewer` using an isolated `.dev` package/configuration; exercised both
settings button handlers and Apply programmatically; observed confetti on three
screens, captured its shapes/palette, and checked automatic dismissal. Wayland
protocol tracing confirmed overlay layer 3, no keyboard interaction and empty
input regions. The Xwayland fallback passed the same three-screen smoke test.
No physical pointer click-through test, sound listening test, real quota-reset
wait or multi-day forecast warm-up was performed. Fullscreen/virtual-desktop
coverage and missing-module fallback still need compositor matrix testing.

## Follow-ups

Out of scope for this change: learned historical Codex pace and dashboard
backfill, burndown/cost charts, the menu-bar layout editor, and account switching.
Optional monthly daily-target copy is also deferred.

Useful CLI additions are a stable opaque account-owner ID, authoritative
freshness/strategy and classified auth-failure metadata, structured pace speed
multiplier/risk provenance, and shared session-equivalent forecasts with history
coverage/sample counts. These would let frontends share the full native model
instead of maintaining independent local observation stores. No CLI changes
were made by this implementation.
