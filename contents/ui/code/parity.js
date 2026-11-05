.pragma library
.import "catalog.js" as Catalog
.import "history.js" as History
.import "sessionEquivalent.js" as Equivalent
.import "pace.js" as Pace
.import "resetDetector.js" as Reset
.import "quotaWarnings.js" as Quota
.import "notificationsMac.js" as Notices

function owner(entry, hash) {
    var u = entry.usage || {}, identity = u.identity || {}
    var id = identity.accountID || identity.accountEmail || u.accountEmail || (typeof entry.account === "string" ? entry.account : "")
    return id ? hash(String(id).trim().toLowerCase()) : ""
}
function lanes(entry, provider) {
    var result = [], usage = entry.usage || {}
    if (provider === "mimo" || provider === "qoder") return result
    if (provider === "antigravity") {
        ;[["session", 300], ["weekly", 10080]].forEach(function (pair) {
            var w = Catalog.antigravityWindowFor(usage, pair[1])
            if (w) result.push({ lane: pair[0], window: Object.assign({}, w, { windowMinutes: pair[1] }), slot: pair[0] === "session" ? "primary" : "secondary" })
        })
        return result
    }
    Catalog.cardSlots(usage, provider).forEach(function (slot) {
        var w = Catalog.usableWindow(usage[slot])
        if (!Catalog.windowUsageKnown(w)) return
        var minutes = Catalog.effectiveWindowMinutes(w, provider, slot)
        if (minutes >= 295 && minutes <= 305) minutes = 300
        if (minutes >= 10070 && minutes <= 10090) minutes = 10080
        var lane = minutes > 0 && minutes <= 360 ? "session" : minutes === 10080 ? "weekly" : ""
        if (lane && !result.some(function (x) { return x.lane === lane }))
            result.push({ lane: lane, window: Object.assign({}, w, { windowMinutes: minutes }), slot: slot })
    })
    if (!result.some(function (x) { return x.lane === "session" })) {
        var primary = Catalog.usableWindow(usage.primary)
        var fallback = provider === "copilot" ? Catalog.usableWindow(usage.secondary) : null
        if (Catalog.windowUsageKnown(primary) && primary.windowMinutes == null) result.push({ lane: "session", window: primary, slot: "primary", resetEligible: false })
        else if (Catalog.windowUsageKnown(fallback)) result.push({ lane: "session", window: fallback, slot: "secondary" })
    }
    return result
}

// Threshold lanes intentionally differ from semantic reset/history lanes.
function warningWindows(entry, provider) {
    var usage = entry.usage || {}, out = []
    if (provider === "mimo" || provider === "qoder") return out
    if (provider === "antigravity") return lanes(entry, provider)
    if (provider === "cursor" && usage.primary && usage.primary.windowMinutes === 10080 && !usage.secondary
        && !(usage.details || []).some(function (row) { return row.label === "Request quota" }))
        return [{ lane: "weekly", window: usage.primary, slot: "primary" }]
    ;[["session", "primary"], ["weekly", "secondary"]].forEach(function (pair) {
        var w = Catalog.usableWindow(usage[pair[1]])
        if (!Catalog.windowUsageKnown(w) || (provider === "claude" && pair[0] === "session" && w.windowMinutes != null && w.windowMinutes > 360)) return
        var label = null
        if (provider === "amp") label = pair[0] === "weekly" ? "Orb usage" : (usage.details || []).some(function (row) { return row.label === "Agent" }) ? "Agent usage" : usage.secondary ? "Other usage" : null
        out.push({ lane: pair[0], window: w, slot: pair[1], label: label })
    })
    if (provider === "claude") (usage.extraRateWindows || []).forEach(function (extra) {
        var w = Catalog.namedWindow(extra)
        if (Catalog.windowUsageKnown(w) && (String(extra.id).indexOf("claude-weekly-scoped-") === 0 || extra.id === "claude-routines"))
            out.push({ lane: "weekly", window: w, id: extra.id, label: extra.title || "weekly" })
    })
    return out
}

function reduce(previous, provider, entry, error, now, opts, hash) {
    var state = previous ? JSON.parse(JSON.stringify(previous)) : { lanes: {} }
    var scoped = !!owner(entry, hash), events = [], forecast = null
    var source = hash(String(entry.source || ""))
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
        state.warnings = state.warnings || {}
        var warningKeys = {}, extrasPresent = false
        warningWindows(entry, provider).forEach(function (item) {
            var lane = item.lane, label = item.label || lane, key = lane + (item.id ? ":" + hash(item.id) : "")
            warningKeys[key] = true
            if (item.id) extrasPresent = true
            var enabled = opts.quotaWarningNotificationsEnabled && opts[lane === "session" ? "quotaWarningSessionEnabled" : "quotaWarningWeeklyEnabled"]
            var o = { remaining: Math.max(0, 100 - item.window.usedPercent), observedAt: capturedAt, source: source }
            var low = enabled ? Quota.threshold(state.warnings[key], o, opts[lane === "session" ? "quotaWarningSessionThresholds" : "quotaWarningWeeklyThresholds"]) : { state: null, threshold: null }
            state.warnings[key] = low.state
            if (low.threshold !== null) post("low", lane, name + " " + label + " quota low", Math.round(Math.min(100, o.remaining)) + "% left. Reached your " + low.threshold + "% " + label + " warning threshold.")
        })
        Object.keys(state.warnings).forEach(function (key) { if (!warningKeys[key] && (key.indexOf(":") < 0 || extrasPresent)) delete state.warnings[key] })
        var windows = lanes(entry, provider), active = {}
        windows.forEach(function (item) {
            var lane = item.lane, w = item.window, remaining = Math.max(0, 100 - w.usedPercent)
            active[lane] = true
            var old = state.lanes[lane] || {}, next = {}
            var o = { provider: provider, lane: lane, remaining: remaining, usedPercent: w.usedPercent,
                observedAt: capturedAt, now: now, source: source, resetBoundary: w.resetsAt ? Date.parse(w.resetsAt) : null,
                plan: usage.identity && usage.identity.loginMethod ? hash(usage.identity.loginMethod.trim().toLowerCase()) : usage.loginMethod ? hash(usage.loginMethod.trim().toLowerCase()) : null,
                requiresLowConfirmation: provider === "claude" && !scoped }
            var session = lane === "session" ? Quota.session(old.session, o, opts.sessionQuotaNotificationsEnabled && (provider !== "codex" || scoped)) : { state: null, kind: null }
            next.session = session.state
            if (session.kind === "depleted") post("depleted", lane, name + " session depleted", "0% left. Will notify when it's available again.")
            var reset = (item.resetEligible === false || (provider === "codex" && !scoped)) ? { state: old.reset || {}, shouldPost: false } : Reset.transition(old.reset, o)
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
            var pair = windows.map(function (x) { return x.lane + ":" + x.slot }).join("|") + ":" + source + ":" + hash(String(usage.identity && usage.identity.loginMethod || usage.loginMethod || ""))
            state.history = History.record(state.pair === pair ? state.history : null, sessionWindow, weeklyWindow, capturedAt)
            state.pair = pair
            var burn = Equivalent.estimate(state.history.session, state.history.weekly, sessionWindow.resetsAt ? Date.parse(sessionWindow.resetsAt) : null, now)
            forecast = Equivalent.forecast(sessionWindow, weeklyWindow, burn, now, Pace.workSeconds(now, Date.parse(weeklyWindow.resetsAt), opts.paceWorkDays))
        }
        if (provider === "codex" && (opts.showOptionalCreditsAndExtraUsage !== false || opts.codexResetCreditExpiryNotificationsEnabled)) {
            var credits = Notices.creditExpiry(state.credits, usage.codexResetCredits && usage.codexResetCredits.credits, now, hash, opts.showOptionalCreditsAndExtraUsage !== false, opts.codexResetCreditExpiryNotificationsEnabled)
            state.credits = credits.state
            if (credits.fire) post("credits", "", "Limit Reset Credits", credits.expiries.map(function (date, i) { return (i + 1) + ". Expires in " + Pace.duration((Date.parse(date) - now) / 1000) }).join("\n"))
        }
    }
    return { state: state, events: events, forecast: forecast }
}
