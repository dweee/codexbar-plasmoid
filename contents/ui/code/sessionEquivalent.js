.pragma library

function valid(e, duration) {
    return isFinite(e.capturedAt) && typeof e.usedPercent === "number" && isFinite(e.usedPercent)
        && e.usedPercent >= 0 && e.usedPercent <= 100 && e.resetsAt !== null
        && isFinite(e.resetsAt) && e.resetsAt - e.capturedAt >= -120000 && e.resetsAt - e.capturedAt <= duration + 120000
}
function nearest(entries, target, tolerance, before) {
    var best = null
    entries.forEach(function (e) {
        if ((!before || e.capturedAt <= target) && Math.abs(e.capturedAt - target) <= tolerance
            && (!best || Math.abs(e.capturedAt - target) < Math.abs(best.capturedAt - target))) best = e
    })
    return best
}
function estimate(session, weekly, currentReset, now, limit) {
    limit = limit === undefined ? 7 : limit
    if (limit <= 0 || (currentReset !== null && !(currentReset > now && currentReset - now <= 18120000))) return null
    function ordered(es) { return es.every(function (e, i) { return isFinite(e.capturedAt) && (!i || e.capturedAt >= es[i - 1].capturedAt) }) }
    if (!ordered(session) || !ordered(weekly)) return null
    var groups = []
    session.forEach(function (e) {
        if (!valid(e, 18000000)) return
        var last = groups[groups.length - 1]
        if (last && Math.abs(last.reset - e.resetsAt) <= 120000) {
            last.entries.push(e); last.max = Math.max(last.max, e.usedPercent)
        } else {
            if (last && last.reset > e.resetsAt) groups = []
            groups.push({ reset: e.resetsAt, entries: [e], max: e.usedPercent })
        }
    })
    var ws = weekly.filter(function (e) { return valid(e, 604800000) })
    var candidates = groups.reverse().filter(function (g) { return g.max > 0 && g.reset <= now && (currentReset === null || g.reset < currentReset - 120000) }).slice(0, limit)
    var burns = []
    candidates.forEach(function (g) {
        var observations = []
        var start = nearest(ws, g.reset - 18000000, 120000, true)
        if (start && start.capturedAt < g.entries[0].capturedAt) observations.push({ s: 0, w: start })
        g.entries.forEach(function (e) { var w = nearest(ws, e.capturedAt, 0, false); if (w) observations.push({ s: e.usedPercent, w: w }) })
        var end = nearest(ws, g.reset, 120000, true)
        if (g.max >= 100 && end && end.capturedAt > g.entries[g.entries.length - 1].capturedAt) observations.push({ s: 100, w: end })
        observations.sort(function (a, b) { return a.w.capturedAt - b.w.capturedAt || a.s - b.s })
        var a = observations[0], b = observations[observations.length - 1]
        if (!a || !b || a.w.capturedAt >= b.w.capturedAt || Math.abs(a.w.resetsAt - b.w.resetsAt) > 120000) return
        var ds = b.s - a.s, dw = b.w.usedPercent - a.w.usedPercent
        if (ds > 0 && dw > 0) burns.push(100 * dw / ds)
    })
    if (burns.length < 3) return null
    burns.sort(function (a, b) { return a - b })
    var mid = Math.floor(burns.length / 2)
    return { medianWeeklyPercentPerWindow: burns.length % 2 ? burns[mid] : (burns[mid - 1] + burns[mid]) / 2, sampleCount: burns.length }
}
function forecast(session, weekly, burn, now, remainingSeconds) {
    if (!session || !weekly || session.isSyntheticPlaceholder || weekly.isSyntheticPlaceholder
        || session.windowMinutes !== 300 || weekly.windowMinutes !== 10080 || !burn || burn.sampleCount < 3
        || !(burn.medianWeeklyPercentPerWindow > 0) || !isFinite(burn.medianWeeklyPercentPerWindow)
        || !isFinite(weekly.usedPercent) || weekly.usedPercent < 0 || weekly.usedPercent >= 100) return null
    var sr = session.resetsAt ? Date.parse(session.resetsAt) : null, wr = Date.parse(weekly.resetsAt)
    if (sr !== null && !(sr > now && sr - now <= 18120000)) return null
    if (!(wr > now && wr - now <= 604920000)) return null
    var available = (remainingSeconds === undefined ? (wr - now) / 1000 : remainingSeconds) / 18000
    return { estimatedWindowsToExhaustWeekly: (100 - weekly.usedPercent) / burn.medianWeeklyPercentPerWindow,
        windowsUntilReset: Math.floor(available), availableWindowsUntilReset: available, sampleCount: burn.sampleCount }
}
function text(f) {
    if (!f) return ""
    var n = Math.round(Math.min(1000000, f.estimatedWindowsToExhaustWeekly) * 10) / 10
    return "Est. " + n.toLocaleString(undefined, { maximumFractionDigits: 1 }) + " session quota" + (n > 0 && n <= 1 ? "" : "s") + " left · "
        + f.windowsUntilReset + " window" + (f.windowsUntilReset === 1 ? "" : "s") + " until reset"
}
