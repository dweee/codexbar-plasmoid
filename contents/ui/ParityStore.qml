import QtQuick
import QtQuick.LocalStorage
import "code/catalog.js" as Catalog
import "code/history.js" as History
import "code/sessionEquivalent.js" as Equivalent
import "code/pace.js" as Pace
import "code/resetDetector.js" as Reset
import "code/quotaWarnings.js" as Quota
import "code/notificationsMac.js" as Notices

QtObject {
    id: store
    property var options
    property var forecasts: ({})
    property string instance: Qt.md5(Date.now() + ":" + Math.random())
    property string databaseName: "codexbar-plasmoid"
    signal eventReady(var event)
    // No account identifier, email, raw source, error or credential is written.
    function owner(entry) {
        var u = entry.usage || {}, identity = u.identity || {}
        var id = identity.accountID || identity.accountEmail || u.accountEmail || entry.account
        return id ? Qt.md5(String(id).trim().toLowerCase()) : ""
    }
    function lanes(entry, provider) {
        var result = [], usage = entry.usage || {}
        Catalog.cardSlots(usage, provider).forEach(function (slot) {
            var w = Catalog.usableWindow(usage[slot])
            if (!w) return
            var minutes = Catalog.effectiveWindowMinutes(w, provider, slot)
            var lane = minutes > 0 && minutes <= 360 ? "session" : minutes === 10080 ? "weekly" : ""
            if (lane && !result.some(function (x) { return x.lane === lane }))
                result.push({ lane: lane, window: Object.assign({}, w, { windowMinutes: minutes }), slot: slot })
        })
        return result
    }
    function process(provider, entry, error, now) {
        if (!entry) return
        var account = owner(entry), scoped = !!account
        // Anonymous series never accumulate history: a hidden account switch
        // cannot be proven safe with the Linux CLI contract.
        var key = provider + ":" + (account || "unknown")
        var events = [], forecast = null
        var opts = options
        var db = LocalStorage.openDatabaseSync(databaseName, "", "CodexBar parity state", 16000000)
        try {
            db.transaction(function (tx) {
                tx.executeSql("CREATE TABLE IF NOT EXISTS parity (key TEXT PRIMARY KEY, value TEXT NOT NULL, touched REAL NOT NULL)")
                tx.executeSql("CREATE TABLE IF NOT EXISTS leases (key TEXT PRIMARY KEY, owner TEXT NOT NULL, expires REAL NOT NULL)")
                var lease = tx.executeSql("SELECT owner, expires FROM leases WHERE key = ?", [key])
                var leader = !lease.rows.length || lease.rows.item(0).owner === instance || lease.rows.item(0).expires <= now
                if (leader) tx.executeSql("INSERT OR REPLACE INTO leases VALUES (?, ?, ?)", [key, instance, now + 45000])
                var rows = tx.executeSql("SELECT value FROM parity WHERE key = ?", [key])
                var state = rows.rows.length ? JSON.parse(rows.rows.item(0).value) : { lanes: {} }
                var source = Qt.md5(String(entry.source || ""))
                var usage = entry.usage || {}
                var capturedAt = Date.parse(usage.updatedAt)
                if (!isFinite(capturedAt)) capturedAt = now
                var fresh = !error && !entry.error && !!entry.usage && !entry.diagnostic && !/cache|localprobe/i.test(String(entry.source || ""))
                var credential = Notices.credential(state.credential, error || entry.error, fresh, opts.credentialExpiryNotificationsEnabled)
                state.credential = credential.state
                function post(kind, lane, title, body) { events.push({ kind: kind, lane: lane, provider: provider, title: title, body: body }) }
                var name = Catalog.meta(provider).name
                if (credential.fire) post("credential", "", name + " needs sign-in", "Open CodexBar to review the account error and sign in again.")
                if (fresh) {
                    var windows = lanes(entry, provider), active = {}
                    windows.forEach(function (item) {
                        var lane = item.lane, w = item.window, remaining = Math.max(0, 100 - w.usedPercent)
                        active[lane] = true
                        var old = state.lanes[lane] || {}, next = {}
                        var o = { provider: provider, lane: lane, remaining: remaining, usedPercent: w.usedPercent,
                            observedAt: capturedAt, now: now, source: source, resetBoundary: w.resetsAt ? Date.parse(w.resetsAt) : null,
                            plan: usage.identity && usage.identity.loginMethod ? Qt.md5(usage.identity.loginMethod.trim().toLowerCase()) : usage.loginMethod ? Qt.md5(usage.loginMethod.trim().toLowerCase()) : null,
                            requiresLowConfirmation: provider === "claude" && !scoped }
                        var enabled = opts.quotaWarningNotificationsEnabled && opts[lane === "session" ? "quotaWarningSessionEnabled" : "quotaWarningWeeklyEnabled"]
                        var low = enabled ? Quota.threshold(old.low, o, opts[lane === "session" ? "quotaWarningSessionThresholds" : "quotaWarningWeeklyThresholds"]) : { state: null, threshold: null }
                        next.low = low.state
                        if (low.threshold !== null) post("low", lane, name + " " + lane + " quota low", Math.round(Math.min(100, remaining)) + "% left. Reached your " + low.threshold + "% " + lane + " warning threshold.")
                        var session = lane === "session" ? Quota.session(old.session, o, opts.sessionQuotaNotificationsEnabled && (provider !== "codex" || scoped)) : { state: null, kind: null }
                        next.session = session.state
                        if (session.kind === "depleted") post("depleted", lane, name + " session depleted", "0% left. Will notify when it's available again.")
                        var reset = Reset.transition(old.reset, o)
                        var notice = Reset.notice(reset.state, old.reset, o, reset.shouldPost, session.kind === "restored", opts)
                        next.reset = reset.state
                        if (notice === "restored") post("restored", lane, name + " session restored", "Session quota is available again.")
                        if (notice === "reset") post("reset", lane, name + " " + lane + " limit reset", "Fresh quota is available.")
                        if (reset.shouldPost && (opts.confettiMode === "both" || opts.confettiMode === lane)) post("confetti", lane, "", "")
                        var pace = Pace.resolve(entry.pace && entry.pace[item.slot], w, w.windowMinutes, now, opts.paceWorkDays, provider)
                        if (opts.predictivePaceWarningNotificationsEnabled && scoped && (provider === "codex" || provider === "claude") && o.resetBoundary !== null) {
                            var predictive = Notices.predictive(old.predictive, pace, o.resetBoundary, w.windowMinutes)
                            next.predictive = predictive.state
                            if (predictive.fire) post("predictive", lane, name + " " + lane + " pace warning", "At the current pace, this quota may run out in " + Pace.duration(pace.etaSeconds) + ", before it resets.")
                        }
                        if (opts.upcomingResetNotificationsEnabled && provider === "codex" && scoped && lane === "weekly" && remaining > 0) {
                            var upcoming = Notices.upcoming(old.upcoming, o.resetBoundary, now)
                            next.upcoming = upcoming.state
                            if (upcoming.fire) post("upcoming", lane, name + " weekly reset soon", Math.round(remaining) + "% of the quota is still unused. It resets in " + Pace.duration((o.resetBoundary - now) / 1000) + " and unused quota is lost.")
                        } else next.upcoming = old.upcoming
                        state.lanes[lane] = next
                    })
                    Object.keys(state.lanes).forEach(function (lane) { if (!active[lane]) delete state.lanes[lane] })
                    var sessionWindow = null, weeklyWindow = null
                    windows.forEach(function (x) { if (x.lane === "session") sessionWindow = x.window; else if (x.lane === "weekly") weeklyWindow = x.window })
                    if (scoped && (provider === "codex" || provider === "claude") && sessionWindow && weeklyWindow && sessionWindow.windowMinutes === 300) {
                        // A source or plan change invalidates pair identity/history.
                        var pair = source + ":" + Qt.md5(String(usage.identity && usage.identity.loginMethod || usage.loginMethod || ""))
                        state.history = History.record(state.pair === pair ? state.history : null, sessionWindow, weeklyWindow, capturedAt)
                        state.pair = pair
                        var burn = Equivalent.estimate(state.history.session, state.history.weekly, sessionWindow.resetsAt ? Date.parse(sessionWindow.resetsAt) : null, now)
                        forecast = Equivalent.forecast(sessionWindow, weeklyWindow, burn, now, Pace.workSeconds(now, Date.parse(weeklyWindow.resetsAt), opts.paceWorkDays))
                    }
                    if (provider === "codex" && opts.codexResetCreditExpiryNotificationsEnabled) {
                        var credits = Notices.creditExpiry(state.credits, usage.codexResetCredits && usage.codexResetCredits.credits, now)
                        state.credits = credits.state
                        if (credits.fire) post("credits", "", "Limit Reset Credits", credits.expiries.map(function (date, i) { return (i + 1) + ". Expires " + new Date(date).toLocaleString() }).join("\n"))
                    }
                }
                // Atomic read/reduce/write coalesces instances even when their
                // lease changes. The lease avoids redundant writes/side effects.
                if (leader) tx.executeSql("INSERT OR REPLACE INTO parity VALUES (?, ?, ?)", [key, JSON.stringify(state), now])
                else events = []
                tx.executeSql("DELETE FROM parity WHERE key IN (SELECT key FROM parity ORDER BY touched DESC LIMIT -1 OFFSET 64)")
                tx.executeSql("DELETE FROM leases WHERE expires < ?", [now - 86400000])
            })
        } catch (e) { console.warn("CodexBar parity persistence failed:", e); return }
        var copy = Object.assign({}, forecasts); copy[key] = forecast; forecasts = copy
        events.forEach(function (event) { store.eventReady(event) })
    }
    function estimateText(provider, entry) {
        if (!entry || !owner(entry)) return ""
        return Equivalent.text(forecasts[provider + ":" + owner(entry)])
    }
}
